import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const changes = readFileSync("supabase/migrations/20261110002000_auth_cron_load_stagger.sql","utf8");
const updatedJobs = [...changes.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)]
  .map(([,name,oldSchedule,newSchedule])=>({name,oldSchedule,newSchedule}));
const base = new Map([
  ["adminos-escalation-alert-worker","1-59/5 * * * *"],
  ["adminos-service-recovery-watch","1-59/2 * * * *"],
  ["adminos-whatsapp-event-worker","*/2 * * * *"],
  ["adminos-whatsapp-media-archive","3-59/10 * * * *"],
  ["resmap-geocode-worker","4-59/10 * * * *"],
  ["reskonnect-expire-room-holds","*/10 * * * *"],
  ["resmap-expire-room-holds","*/5 * * * *"],
  ["adminos-executive-brief","0 4 * * *"],
  ["adminos-lead-scoring","15 */6 * * *"],
  ["adminos-dimpho-morning-brief","15 5 * * *"],
  ["adminos-rg12-search-console-sync","15 5 * * *"],
  ["luna-content-cycle","17 */6 * * *"],
  ["adminos-executive-alerts","5 * * * *"],
  ["adminos-whatsapp-rich-content-sync","7 * * * *"],
]);
for (const {name,newSchedule} of updatedJobs) base.set(name,newSchedule);

const scheduledAtMinute = (schedule,minute) => {
 const field = schedule.split(" ")[0];
 if(field==="*") return true;
 if(field.startsWith("*/")) return minute % Number(field.slice(2)) === 0;
 const match=field.match(/^(\d+)-59\/(\d+)$/);
 if(match) return minute>=Number(match[1]) && (minute-Number(match[1]))%Number(match[2])===0;
 return Number(field)===minute;
};

test("cron staggering is retryable and touches no critical booking jobs",()=>{
 assert.equal(updatedJobs.length,17);
 assert.match(changes,/cron\.alter_job/);
 assert.match(changes,/job\.schedule = item\.new_schedule/);
 assert.match(changes,/job\.schedule <> item\.old_schedule/);
 assert.doesNotMatch(changes,/cron\.unschedule/);
 assert.doesNotMatch(changes,/\('(?:reskonnect-expire-room-holds|resmap-expire-room-holds)'/);
});
test("every optimized schedule preserves its prior recurrence",()=>{
 for(const {name,oldSchedule,newSchedule} of updatedJobs){
  const count=(s)=>Array.from({length:60},(_,i)=>scheduledAtMinute(s,i)).filter(Boolean).length;
  assert.equal(count(oldSchedule),count(newSchedule),name);
 }
});
test("in a modeled full hour no more than 8 cron jobs start in one minute",()=>{
 const loads=Array.from({length:60},(_,i)=>[i,[...base.values()].filter(s=>scheduledAtMinute(s,i)).length]);
 assert.ok(Math.max(...loads.map(x=>x[1]))<=8,"too many simultaneous starts: "+JSON.stringify(loads));
});
