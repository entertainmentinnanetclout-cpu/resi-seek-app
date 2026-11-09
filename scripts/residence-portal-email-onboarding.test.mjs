import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=p=>readFileSync(p,"utf8");
const sql=read("supabase/migrations/20261109054000_portal_email_verified_invitations.sql");
const edge=read("supabase/functions/admin-residence-portal-accounts/index.ts");
const ui=read("src/pages/admin/AdminResidencePortals.tsx");

test("Auth is authoritative; an imported profile alone never impersonates a login",()=>{
 assert.ok(edge.includes('portal_lookup_login_email'));
 assert.ok(edge.includes('found?.auth_user_id'));
 assert.ok(edge.includes('found.is_verified'));
 assert.ok(edge.includes('found.is_invited'));
 assert.ok(!edge.includes('getUserById(profiles[0].id)'));
});
test("historical contacts remain preserved in a private audited archive",()=>{
 assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS reskonnect_internal.portal_orphan_email_archive'));
 assert.ok(sql.includes('archived_by uuid NOT NULL'));
 assert.ok(sql.includes('GRANT EXECUTE ON FUNCTION public.portal_prepare_orphan_profile_email'));
 assert.ok(sql.includes('REVOKE ALL ON FUNCTION public.portal_prepare_orphan_profile_email'));
 assert.ok(sql.includes('auth.users u ON u.id=p.id'));
 assert.ok(sql.includes('public.adminos_contacts'));
 assert.ok(sql.includes('public.adminos_enquiry_threads'));
 assert.ok(sql.includes('manual reconciliation required'));
 assert.ok(!sql.includes('DELETE FROM public.profiles'));
 assert.ok(!sql.includes('UPDATE auth.users'));
 assert.ok(edge.includes('portal_restore_orphan_profile_email'));
});
test("new team members can accept an invitation; existing verified users keep passwords",()=>{
 assert.ok(edge.includes('db.auth.admin.inviteUserByEmail'));
 assert.ok(edge.includes('redirectTo:"https://www.reskonnect.org/auth"'));
 assert.ok(edge.includes('!found.is_verified&&!found.is_invited'));
 assert.ok(edge.includes('created_user:createdByRequest'));
 assert.ok(edge.includes('existing_login:!createdByRequest'));
 assert.ok(ui.includes('Secure invitation sent.'));
 assert.ok(ui.includes('original passwords.'));
 assert.ok(ui.includes('Leave blank to send a secure activation invitation'));
});
test("replacing the residence email does not rename another persons global Auth login",()=>{
 assert.ok(edge.includes('portal_replace_residence_login'));
 assert.ok(sql.includes('public.portal_replace_residence_login'));
 assert.ok(sql.includes('UPDATE public.residence_portal_accounts'));
 assert.ok(sql.includes("DELETE FROM public.user_roles"));
 assert.ok(sql.includes("'replaced'"));
 assert.ok(edge.includes('Save residence, role or status changes first'));
 assert.ok(ui.includes("previous person's ResKonnect account"));
 assert.ok(!edge.includes('updateUserById(account.user_id,{email:'));
});
test("all role-changing endpoints still require authorized staff, and cannot create four accounts",()=>{
 assert.ok(edge.includes('eq("role","admin")'));
 assert.ok(edge.includes('db.auth.getUser(token)'));
 assert.ok(edge.includes('residenceCount(residenceId)>=3'));
 assert.ok(sql.includes("current_setting('request.jwt.claim.role',true)"));
 assert.ok(sql.includes('public.has_role(p_admin_id'));
 assert.ok(sql.includes('EXISTS (SELECT 1 FROM public.residence_portal_accounts'));
});
