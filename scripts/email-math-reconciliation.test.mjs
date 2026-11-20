import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(path)=>readFileSync(path,"utf8");
const migration=read("supabase/migrations/20261120183000_email_coverage_status_sync.sql");
const api=read("supabase/functions/reskonnect-email-dock/index.ts");
const mail=read("supabase/functions/reskonnect-email-dock/send.ts");
const ui=read("src/components/communications/PremiumEmailDock.tsx");
const context=read("supabase/functions/reskonnect-email-dock/context.ts");

test("ten-email batches remain sequential and each Gmail/PDF send gets its own Edge request",()=>{
 assert.match(api,/action==="bulk_send"\|\|action==="bulk_preview"\?10:25/);
 assert.match(ui,/if\(ids\.length>10\)return toast\.error/);
 assert.match(ui,/for\(const id of ids\)/);
 assert.match(ui,/ids:\[id\],requests:\[request\]/);
 assert.match(ui,/Select 10 email/);
 assert.match(ui,/maximum 10 sends per email batch/);
 assert.match(ui,/25 for status/);
 assert.match(ui,/if\(updateAvailable\)return toast\.warning/);
});

test("exact email mathematics partitions distinct cases independently of message count or templates",()=>{
 assert.match(migration,/count\(\*\) filter\(where sent_count>0\)/);
 assert.match(migration,/count\(\*\) filter\(where sent_count=0\)/);
 assert.match(migration,/coalesce\(sum\(sent_count\),0\)/);
 assert.match(migration,/attempted_count=0/);
 assert.match(migration,/sent_count=0 and uncertain_count>0/);
 assert.match(migration,/sent_count=0 and uncertain_count=0 and failed_count>0/);
 assert.match(api,/emailed\+notSent!==total/);
 assert.match(api,/never\+uncertain\+failed!==notSent/);
 assert.match(api,/messages<emailed/);
 assert.match(ui,/Select up to 10 never attempted/);
 assert.match(ui,/coverage\.never_attempted_case_ids/);
 assert.match(context,/residence_id:c\.residenceId/);
 const reconciled={reservations:67,emailed:60,noConfirm:7,mailCount:68,receivedOnly:56};
 assert.equal(reconciled.emailed+reconciled.noConfirm,reconciled.reservations);
 assert.ok(reconciled.mailCount>=reconciled.emailed);
 assert.notEqual(reconciled.receivedOnly,reconciled.emailed,"a template count is never contact coverage");
});

test("a provider-confirmed official email may only progress safe non-final statuses",()=>{
 assert.match(migration,/v_mail\.delivery_status <> 'sent' or v_mail\.provider_message_id is null/);
 assert.match(migration,/sender_scope' is distinct from 'reskonnect'/);
 assert.match(migration,/r\.role='admin'/);
 assert.match(migration,/v_current is distinct from v_mail\.context_snapshot->>'recorded_status'/);
 assert.match(migration,/for update/);
 assert.match(migration,/status=v_new,last_contacted_at=v_mail\.sent_at/);
 assert.match(migration,/public\.reskonnect_email_status_sync_audit/);
 assert.match(migration,/email_id uuid not null unique/);
 assert.match(mail,/await s\.db\.rpc\("rk_email_sync_after_send",\{p_email_id:log\.id\}\)/);
 const mapper=migration.split("create or replace function reskonnect_internal.rk_email_nonfinal_status")[1].split("$fn$;")[0];
 assert.match(mapper,/then 'contacted'/);
 assert.match(mapper,/then 'under_review'/);
 assert.match(mapper,/then 'documents_required'/);
 for(const final of ["approved","confirmed","rejected","conditionally_approved","cancelled","provisional_hold"]){
  assert.doesNotMatch(mapper,new RegExp("then '"+final+"'"),"never auto-authorize final "+final);
 }
 assert.match(migration,/revoke all on function public\.rk_email_sync_after_send\(uuid\) from public,anon,authenticated/);
 assert.match(migration,/grant execute on function public\.rk_email_sync_after_send\(uuid\) to service_role/);
 assert.match(migration,/reskonnect_email_status_sync_audit enable row level security/);
});

test("a failed or uncertain Gmail request cannot update a student status",()=>{
 const accepted=mail.indexOf('if(!sent.ok)');
 const provider=mail.indexOf('let providerId:');
 const reconcile=mail.indexOf('rpc("rk_email_sync_after_send"');
 assert.ok(accepted>=0&&provider>accepted&&reconcile>provider);
 assert.match(mail,/if\(providerId\)\{/);
 assert.match(mail,/status_sync:statusSync/);
 assert.match(ui,/batchSummary\.unconfirmed/);
 assert.match(ui,/status_sync\?\.applied/);
});
