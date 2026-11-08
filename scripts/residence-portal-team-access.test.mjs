import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(path,"utf8");
const ui=read("src/pages/admin/AdminResidencePortals.tsx");
const mgmt=read("supabase/functions/admin-residence-portal-accounts/index.ts");
const schema=read("supabase/migrations/20261108223000_residence_portal_team_accounts.sql");
const resolver=read("src/lib/residencePortal.ts");
const pdf=read("supabase/functions/reskonnect-email-dock/pdf.ts");
const gmail=read("supabase/functions/gmail-connect/index.ts");

test("portal management routes to the active ResKonnect Supabase functions host",()=>{
 assert.match(ui,/supabase\.functions\.invoke\("admin-residence-portal-accounts"/);
 assert.doesNotMatch(ui,/invokeEdgeFunction/);
 assert.match(mgmt,/Deno\.serve/);
 assert.match(mgmt,/req\.method==="OPTIONS"/);
 assert.match(mgmt,/Access-Control-Allow-Headers/);
 assert.match(mgmt,/x-supabase-client-platform/);
 assert.match(mgmt,/db\.auth\.getUser\(token\)/);
 assert.match(mgmt,/eq\("role","admin"\)/);
});
test("the team limit is enforced by a serialized database trigger, including disabled accounts",()=>{
 assert.match(schema,/PRIMARY KEY \(id\)/);
 assert.match(schema,/FOR UPDATE/);
 assert.match(schema,/member_count>=3/);
 assert.match(schema,/maximum of three portal login emails/);
 assert.match(schema,/CREATE TRIGGER residence_portal_team_limit/);
 assert.match(schema,/portal_role IN \('owner','manager','admin'\)/);
 assert.match(schema,/residence_portal_one_owner_idx/);
 assert.match(ui,/length}\/3/);
 assert.match(ui,/portal_role:editRole/);
 assert.match(ui,/portal_role:newRole/);
});
test("edit, suspend and delete target only the selected membership, never a whole residence",()=>{
 assert.match(ui,/action:"update",account_id:editing\.id/);
 assert.match(ui,/action:"update",account_id:account\.id/);
 assert.match(ui,/action:"delete",account_id:account\.id/);
 assert.match(mgmt,/\.eq\("id",id\)/);
 assert.match(mgmt,/admin_delete_residence_portal_account/);
 assert.doesNotMatch(mgmt,/admin_delete_residence_portal",/);
 assert.match(schema,/replaced by per-account revocation/);
});
test("existing student users may be linked without resetting their login password",()=>{
 assert.match(mgmt,/existingIdentity\.user\.email/);
 assert.match(mgmt,/existing_login:!createdByRequest/);
 assert.match(mgmt,/if\(createdByRequest\)await db\.auth\.admin\.deleteUser/);
 assert.match(mgmt,/Role assignment|residence_portal/);
});
test("email-only claims cannot mutate residence or account authority",()=>{
 assert.match(schema,/DROP POLICY IF EXISTS rpa_self_claim_by_email/);
 assert.match(schema,/email_confirmed_at IS NOT NULL/);
 assert.match(schema,/CREATE OR REPLACE FUNCTION public\.claim_residence_portal_account/);
 assert.match(resolver,/rpc\("claim_residence_portal_account"\)/);
 assert.doesNotMatch(resolver,/\.update\(\{ user_id:/);
});
test("a 4-step OAuth flow still keeps mailbox permissions per person",()=>{
 const guide=read("src/components/communications/LandlordGmailGuide.tsx");
 assert.match(guide,/Connect your email in 4 simple steps/);
 assert.match(gmail,/https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
 assert.match(gmail,/code_challenge_method","S256"/);
 assert.match(gmail,/\.eq\("user_id",user\.id\)/);
 assert.match(guide,/Do not share your password/);
});
test("premium PDFs remain vector sharp with adaptive images and a next-action panel",()=>{
 const send=read("supabase/functions/reskonnect-email-dock/send.ts");
 const media=read("supabase/functions/reskonnect-email-dock/residence-media.ts");
 assert.match(pdf,/StandardFonts\.Helvetica/);
 assert.match(pdf,/favicon-transparent\.png/);
 assert.match(pdf,/maxW\/photo\.width,maxH\/photo\.height/);
 assert.match(pdf,/YOUR NEXT STEP/);
 assert.match(pdf,/nextStep\?:string/);
 assert.match(send,/nextStep:packet\.next_step/);
 assert.match(media,/6_000_000/);
});
