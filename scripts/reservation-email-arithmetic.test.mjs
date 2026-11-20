import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {summarizeReservationCorrespondence} from "../supabase/functions/reskonnect-email-dock/reservation-reconciliation.ts";

const read=path=>readFileSync(path,"utf8");
const reservation=(n)=>({
 id:"00000000-0000-4000-8000-"+String(n).padStart(12,"0"),
 applicant_name:"Test "+n,created_at:"2026-11-01T11:00:00Z",status:"reserved"
});
const mail=(r,index,key="triage_received",status="sent",timestamp="2026-11-20T09:00:00Z")=>({
 id:"m-"+index,target_id:r.id,template_key:key,delivery_status:status,
 created_at:timestamp,sent_at:status==="sent"?timestamp:null,
 provider_message_id:status==="sent"?"gmail-"+index:null
});

test("67 Berlin-style reservations reconcile exactly: 68 accepted emails, 60 unique, 56 triage receipts and seven untouched",()=>{
 const people=Array.from({length:67},(_,i)=>reservation(i+1));
 const messages=people.slice(0,60).map((r,i)=>mail(r,i,i<56?"triage_received":"triage_under_review","sent",i<53?"2026-11-20T10:00:00Z":"2026-11-17T10:00:00Z"));
 for(let i=0;i<8;i++)messages.push(mail(people[i],60+i,"documents_needed","sent","2026-11-09T10:00:00Z"));
 messages.push(mail(people[0],68,"triage_under_review","unknown"));
 const s=summarizeReservationCorrespondence(people,messages);
 assert.equal(s.total_reservations,67);
 assert.equal(s.sent_messages,68);
 assert.equal(s.provider_receipts,68);
 assert.equal(s.unique_reservations_emailed,60);
 assert.equal(s.repeat_sent_messages,8);
 assert.equal(s.coverage_percent,89.6);
 assert.equal(s.not_emailed,7);
 assert.equal(s.never_attempted,7);
 assert.equal(s.uncertain_only,0);
 assert.equal(s.with_additional_uncertainty,1);
 assert.equal(s.uncertain_attempts,1);
 assert.equal(s.total_attempts,69);
 assert.equal(s.by_template.find(t=>t.template==="triage_received")?.count,56);
 assert.equal(s.by_day.find(t=>t.day==="2026-11-20")?.count,53);
 assert.equal(s.pending.length,7);
 assert.equal(s.pending.filter(x=>x.reason==="never_attempted").length,7);
 assert.equal(s.unique_reservations_emailed+s.never_attempted+s.uncertain_only+s.failed_only,people.length);
 assert.equal(s.by_day.reduce((sum,x)=>sum+x.count,0),s.sent_messages);
 assert.equal(s.by_template.reduce((sum,x)=>sum+x.count,0),s.sent_messages);
});

test("ambiguous and failed-only cases never appear as safely uncontacted",()=>{
 const people=Array.from({length:4},(_,i)=>reservation(i+1));
 const messages=[
  mail(people[0],0,"triage_received","sent"),
  mail(people[1],1,"triage_received","unknown"),
  mail(people[2],2,"triage_received","failed")
 ];
 const s=summarizeReservationCorrespondence(people,messages);
 assert.equal(s.unique_reservations_emailed,1);
 assert.equal(s.uncertain_only,1);
 assert.equal(s.failed_only,1);
 assert.equal(s.never_attempted,1);
 assert.equal(s.not_emailed,3);
 assert.equal(s.pending.find(x=>x.id===people[1].id)?.reason,"uncertain_only");
});

test("zero denominator is not presented as 100 percent",()=>{
 const s=summarizeReservationCorrespondence([],[]);
 assert.equal(s.coverage_percent,null);
 assert.equal(s.sent_messages,0);
 assert.equal(s.not_emailed,0);
});

test("scope escape or duplicate reservation IDs must fail closed",()=>{
 const c=reservation(1);
 assert.throws(()=>summarizeReservationCorrespondence([c,c],[]),/Duplicate reservation/);
 assert.throws(()=>summarizeReservationCorrespondence([c],[mail(reservation(99),1)]),/escaped/);
});

test("10-message email batch is bounded while each send uses one PDF per request",()=>{
 const api=read("supabase/functions/reskonnect-email-dock/index.ts");
 const dock=read("src/components/communications/PremiumEmailDock.tsx");
 const panel=read("src/components/communications/ReservationEmailReconciliation.tsx");
 assert.match(api,/action==="bulk_send"\|\|action==="bulk_preview"\?10:25/);
 assert.match(dock,/if\(ids\.length>10\)/);
 assert.match(dock,/ids:\[id\],requests:\[request\]/);
 assert.match(dock,/new Set\(ids\.slice\(0,10\)\)/);
 assert.match(panel,/never-attempted|never_attempted/);
 assert.match(api,/action==="reservation_reconciliation"/);
});
