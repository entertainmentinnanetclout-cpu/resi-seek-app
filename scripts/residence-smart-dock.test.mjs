import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p)=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261120200500_residence_smart_dock_sender_budget.sql");
const api=read("supabase/functions/reskonnect-email-dock/index.ts");
const mail=read("supabase/functions/reskonnect-email-dock/send.ts");
const context=read("supabase/functions/reskonnect-email-dock/context.ts");
const ui=read("src/components/communications/PremiumEmailDock.tsx");

test("Residence tabs scope the backend queue; switching application and reservation preserves accommodation",()=>{
 assert.match(api,/action==="residence_directory"/);
 assert.match(api,/residenceId&&!canView\(s,residenceId\)/);
 assert.match(api,/if\(!residenceId\|\|c\.residenceId===residenceId\)/);
 assert.match(context,/q\.eq\("residence_id",options\.residenceId\)/);
 assert.match(ui,/residence_id:selectedResidence\|\|undefined,offset:0/);
 assert.match(ui,/residence_id:selectedResidence\|\|undefined,offset/);
 assert.match(ui,/const selectResidence=\(id:string\)=>/);
 assert.match(ui,/aria-label="Open accommodation workspace"/);
 const switching=ui.slice(ui.indexOf("const selectKind="),ui.indexOf("const selectResidence="));
 assert.doesNotMatch(switching,/setSelectedResidence\(""/);
});
test("Only evidence can establish Gmail and WhatsApp progress",()=>{
 assert.match(sql,/rk_residence_case_channel_snapshot/);
 assert.match(sql,/w\.status='operator_marked_sent'/);
 assert.match(sql,/w\.status='opened'/);
 assert.match(context,/email_notice_due:statusNoticeDue/);
 assert.match(context,/whatsapp_notice_due:whatsappStale/);
 assert.match(ui,/Email accepted · WhatsApp not marked sent/);
 assert.match(ui,/New status email required/);
 assert.match(ui,/Status saved in ResKonnect/);
 assert.match(ui,/operator-marked sent/);
 assert.match(ui,/delivery\/read not verified/);
});
test("450 per sender by default and 1800 only after verified Workspace admin MFA",()=>{
 assert.match(sql,/then 1800 else 450/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/created_at>=now\(\)-interval '24 hours'/);
 assert.match(sql,/delivery_status in \('sending','sent','unknown'\)/);
 assert.match(api,/action==="sender_budget"\|\|action==="set_sender_tier"/);
 assert.match(api,/workspace_license_verified!==true/);
 assert.match(api,/claims\?\.aal==="aal2"/);
 assert.match(mail,/rk_gmail_reserve_send/);
 assert.match(mail,/rk_gmail_sender_pause/);
 assert.match(mail,/if\(sent\.status===429\)/);
 assert.doesNotMatch(mail,/>=80|80 message attempts/);
 assert.match(ui,/senderBudget\.remaining/);
});
test("Ten reviewed one-email-per-Edge-request batches remain intact",()=>{
 assert.match(ui,/if\(ids\.length>10\)return toast\.error/);
 assert.match(ui,/for\(const id of ids\)/);
 assert.match(ui,/ids:\[id\],requests:\[request\]/);
 assert.match(ui,/do not resend/i);
});
