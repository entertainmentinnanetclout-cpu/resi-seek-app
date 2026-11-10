import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/migrations/20261110084500_db_io_write_amplification_fix.sql","utf8");
test("occupancy job skips duplicates and no-op refresh updates",()=>{
 assert.match(sql,/pg_try_advisory_xact_lock\(81408,p_academic_year\)/);
 assert.match(sql,/where \([\s\S]*?\) is distinct from \(/);
 assert.match(sql,/existing\.metadata->>'automation_key'=action_key/);
 assert.match(sql,/existing\.created_at >= now\(\)-interval '30 days'/);
 assert.match(sql,/resolved_by_rg8_state_change_at/);
 assert.doesNotMatch(sql,/Close previous RG8 tasks for this year, then rebuild/);
});
test("prospect event fires on meaningful status or score change only",()=>{
 assert.match(sql,/tg_op='UPDATE'/);
 assert.match(sql,/new\.stage,new\.score,new\.priority/);
 assert.match(sql,/is not distinct from \(old\.stage,old\.score,old\.priority\)/);
});
test("noncritical Cron work is staged but bookings and real-time messages are untouched",()=>{
 for(const name of ["adminos-next-best-action-refresh","adminos-proactive-whatsapp",
 "adminos-rg7-application-operations","adminos-rg8-occupancy-intelligence",
 "adminos-rg9-student-opportunities","adminos-rg10-partnerships","adminos-rg11-reputation"]){
  assert.ok(sql.includes(name),name);
 }
 assert.match(sql,/cron\.alter_job/);
 assert.doesNotMatch(sql,/cron\.unschedule|DELETE FROM public\.staff_tasks|DELETE FROM cron\.job_run_details/i);
 assert.doesNotMatch(sql,/\('(?:resmap-expire-room-holds|reskonnect-expire-room-holds)'/);
});
