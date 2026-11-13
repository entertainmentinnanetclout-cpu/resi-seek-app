import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const foundation=read("supabase/migrations/20261113191500_rk_case_operations_foundation.sql");
const operations=read("supabase/migrations/20261113192500_rk_case_command_and_delegation_rpcs.sql");
const final=read("supabase/migrations/20261113195000_rk_final_case_actions_and_landlord_alerts.sql");
const verificationGuard=read("supabase/migrations/20261113195700_rk_document_verification_intake_guard.sql");
const eligibilityGuard=read("supabase/migrations/20261113202500_rk_explicit_ineligible_assessment.sql");
const mailMigration=read("supabase/migrations/20261113193500_rk_safe_triage_correspondence.sql");
const app=read("src/App.tsx");
const adminNav=read("src/components/admin/AdminLayout.tsx");
const landlordNav=read("src/pages/residence/ResidenceLayout.tsx");
const admin=read("src/pages/admin/AdminCaseCommandCenter.tsx");
const landlord=read("src/pages/residence/ResidenceEligibilityDesk.tsx");
const landlordDetail=read("src/pages/residence/ResidenceApplicationDetail.tsx");
const landlordReservations=read("src/pages/residence/ResidenceReservations2027.tsx");
const communications=read("supabase/functions/reskonnect-email-dock/index.ts");
const letters=read("supabase/functions/reskonnect-email-dock/correspondence.ts");
const send=read("supabase/functions/reskonnect-email-dock/send.ts");
const context=read("supabase/functions/reskonnect-email-dock/context.ts");
const fingerprint=read("supabase/functions/reskonnect-email-dock/case-queue.ts");
const snapshot=JSON.parse(read("scripts/backend-live-contracts.snapshot.json"));
test("case workflow tables are private and God Mode commands require MFA",()=>{
 for(const name of ["rk_case_workflows","rk_case_tasks","rk_case_operation_audit","rk_case_collaboration"]){
  assert.match(foundation,new RegExp("create table if not exists public\\."+name));
  assert.match(foundation,new RegExp("alter table public\\."+name+" enable row level security"));
  assert.ok(snapshot.public_relations.includes(name));
 }
 assert.match(foundation,/revoke all on public\.rk_case_workflows,public\.rk_case_tasks,public\.rk_case_operation_audit,public\.rk_case_collaboration from public,anon,authenticated/);
 assert.match(foundation,/auth\.jwt\(\)->>\x27aal\x27/);
 assert.match(foundation,/=\x27aal2\x27/);
 assert.match(operations,/reskonnect_internal\.rk_godmode_authorized\(\)/);
 assert.match(operations,/revoke all on function public\.rk_case_bulk_apply\(text,uuid\[\],text,text,jsonb,uuid\) from public,anon,authenticated/);
 assert.doesNotMatch(operations,/grant all on public\.rk_case_(?:workflows|tasks)/);
});
test("students cannot forge verified document metadata at intake",()=>{
 assert.match(verificationGuard,/create trigger aa_rk_document_verification_guard before insert or update/);
 assert.match(verificationGuard,/create trigger aa_rk_application_document_verification_guard before insert or update/);
 assert.match(verificationGuard,/Uploaded documents cannot be pre-verified/);
 assert.match(verificationGuard,/Verified documents require reviewer and verification timestamp/);
 assert.match(verificationGuard,/public\.is_authorized_residence_user\(new\.residence_id\)/);
 assert.match(verificationGuard,/public\.has_admin_department_access\('accommodation'\)/);
});
test("verified evidence and ResKonnect handover block new final approvals at the database",()=>{
 assert.match(foundation,/v_w?.*handover_approved_at|v_workflow\.handover_approved_at/s);
 assert.match(foundation,/v_workflow\.eligibility_decision<>'eligible'/);
 assert.match(foundation,/d\.verified_at/);
 assert.match(foundation,/verified_at is not null/);
 assert.match(foundation,/rk_final_reservation_handover_gate/);
 assert.match(foundation,/rk_final_application_handover_gate/);
 assert.match(foundation,/reskonnect_internal\.rk_case_document_readiness/);
 assert.match(final,/p_action='approve_application'/);
 assert.match(final,/update public\.applications set status='approved'/);
 assert.match(final,/p_action='confirm_reservation'/);
 assert.match(operations,/h\.status='active'/);
 assert.match(operations,/rm\.inventory_kind='physical_room'/);
});
test("audited bulk operations are versioned and cannot silently send an external message",()=>{
 for(const t of ["acknowledge_received","start_review","request_documents","delegate_review","mark_eligible","approve_handover","confirm_reservation","internal_note","mark_follow_up"])
  assert.ok(operations.includes(t),"missing action "+t);
 for(const t of ["approve_application","reject_application","cancel_reservation"])
  assert.ok(final.includes(t),"missing final operation "+t);
 assert.match(operations,/for update/);
 assert.match(operations,/Case status or review stage changed/);
 assert.match(operations,/operation_id=p_operation_id/);
 assert.match(foundation,/unique\(actor_user_id,operation_id,kind,case_id\)/);
 assert.match(operations,/emails_sent',0/);
 assert.match(eligibilityGuard,/p_action=\x27mark_ineligible\x27/);
 assert.match(eligibilityGuard,/eligibility_decision=\x27ineligible\x27/);
 assert.match(eligibilityGuard,/Eligibility assessment:/);
 assert.match(admin,/mark_ineligible/);
 assert.match(admin,/rk_case_bulk_preview/);
 assert.match(admin,/rk_case_bulk_apply/);
 assert.match(admin,/Type CONFIRM/);
 assert.match(admin,/window\.confirm/);
});
test("landlord work is delegated and cannot approve student placement",()=>{
 assert.match(operations,/public\.is_authorized_residence_user\(v_task\.residence_id\)/);
 assert.match(operations,/public\.rk_landlord_review_task/);
 assert.match(operations,/ResKonnect decision required/);
 assert.match(final,/New student eligibility task/);
 assert.match(operations,/only ResKonnect|Only ResKonnect/);
 assert.match(landlord,/rk_landlord_review_task/);
 assert.match(landlord,/rk_case_profile_packet/);
 assert.match(landlord,/residence\/communications\?kind=/);
 assert.match(landlord,/rk_case_collaboration_post/);
 assert.doesNotMatch(landlord,/\.update\(\{status:\s*["'](?:approved|confirmed)/);
 assert.doesNotMatch(landlordDetail,/value:"approved",label:"Approve"/);
 assert.doesNotMatch(landlordDetail,/value:"rejected",label:"Reject"/);
 assert.match(landlordReservations,/disabled=\{!landlordStatuses\.includes\(value\)\}/);
});
test("fixed receipt and review-start messages may be sent without document-review receipts but no decision bypass",()=>{
 assert.match(mailMigration,/triage_received/);
 assert.match(mailMigration,/triage_under_review/);
 assert.match(letters,/This message only acknowledges receipt/);
 assert.match(letters,/This is not a reservation confirmation/);
 assert.match(send,/if\(fixedTriage&&note\.trim\(\)\)/);
 assert.match(send,/ctx\.reviewStage!=="under_review"/);
 assert.match(send,/if\(selected==="approved"&&!statusIs/);
 assert.match(send,/if\(selected==="reservation_confirmed"/);
 assert.match(communications,/if\(!fixedTriage\)await assertReviewed\(s,c,input\.document_review_id\)/);
 assert.match(communications,/if\(!fixedTriage\)await assertReviewed\(s,c,item\.document_review_id\)/);
 assert.match(communications,/if\(fixedTriage&&\(note\.length>0/);
 assert.match(communications,/claims\?\.aal==="aal2"/);
 assert.match(communications,/if\(!isAdmin\|\|!verifiedAal\)/);
 assert.match(context,/rk_case_workflows/);
 assert.match(fingerprint,/reviewStage:c\.reviewStage/);
 assert.match(admin,/bulk_preview/);
 assert.match(admin,/bulk_send/);
 assert.match(admin,/whatsapp_handoff/);
 assert.match(admin,/Preview up to 5 selected WhatsApp messages/);
 assert.match(admin,/Open WhatsApp to send/);
 assert.match(admin,/operator_confirmed:true/);
 assert.doesNotMatch(admin,/sendGrid|massWhatsappAutomation/);
});
test("React routes and private operations drawers are part of the original ResKonnect app",()=>{
 assert.match(app,/path="\/admin\/cases"/);
 assert.match(app,/AdminCaseCommandCenter/);
 assert.match(app,/path="eligibility" element=\{<ResidenceEligibilityDesk/);
 assert.match(adminNav,/to="\/admin\/cases"/);
 assert.match(landlordNav,/path: "\/residence\/eligibility"/);
 assert.match(admin,/rk_case_collaboration_list/);
 assert.match(admin,/rk_case_collaboration_post/);
 assert.match(landlord,/internal ResKonnect discussion|Internal ResKonnect discussion/);
 assert.match(admin,/rk-motion/);
 assert.match(landlord,/rk-motion/);
});
test("published live callable RPC inventory includes all seven constrained endpoints",()=>{
 const names=["rk_case_bulk_apply","rk_case_bulk_preview","rk_case_queue","rk_case_profile_packet","rk_landlord_review_task","rk_case_collaboration_post","rk_case_collaboration_list"];
 for(const name of names){
  const fn=snapshot.callable_routines.find(x=>x.name===name);
  assert.ok(fn,name);assert.equal(fn.anon,false);
  assert.equal(fn.authenticated,true);
 }
});
