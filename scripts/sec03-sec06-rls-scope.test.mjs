import {strict as assert} from "node:assert";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const pass=(value,msg)=>{assert.ok(value,msg);console.log("PASS",msg);};
const roommate=read("supabase/migrations/20261114222000_sec03_roommate_recruiter_invoker_views.sql");
const ownership=read("supabase/migrations/20261114222500_sec04_sec06_owner_oracle_landlord_update_guard.sql");
const landlord=read("supabase/migrations/20261114223500_sec03_scoped_landlord_invoker_views.sql");

pass(roommate.includes("roommate_profiles_public_v") &&
 roommate.includes("security_barrier=true,security_invoker=true") &&
 roommate.includes("rk_roommate_cards_opt_in_read"),
 "Roommate view runs with caller RLS against opt-in projection rather than private profiles");
pass(roommate.includes("where p.looking_for_roommate=true") &&
 roommate.includes("if coalesce(new.looking_for_roommate,false) is not true") &&
 roommate.includes("after insert or update or delete on public.profiles"),
 "Profile opt-out deletes public roommate card; every profile mutation resyncs the projection");
pass(roommate.includes("where k.key in ('sleepSchedule','studyHabits','cleanliness','socialLevel','smoking')"),
 "Lifestyle metadata is constrained to the five intentional sharing fields");
pass(!roommate.includes("grant select on public.profiles to anon") &&
 !roommate.includes("grant select on public.profiles to authenticated"),
 "No wider direct grants were added to the sensitive profiles table");
pass(roommate.includes("rk_approved_recruiter_read_enabled_programmes") &&
 roommate.includes("ra.status='approved'") &&
 roommate.includes("'referral_agent'::public.app_role") &&
 roommate.includes("alter view public.recruitable_residences_v set(security_invoker=true)"),
 "Recruitment commission view enforces active recruiter entitlement through RLS");

pass(landlord.includes("rk_portal_application_cards_scoped_select") &&
 landlord.includes("rk_portal_lead_cards_scoped_select") &&
 landlord.includes("public.is_authorized_residence_user(residence_id)") &&
 landlord.includes("auth.uid() is not null"),
 "Both residence portal safe tables require caller identity and the assigned residence");
pass(landlord.includes("from public.rk_residence_portal_application_cards") &&
 landlord.includes("from public.rk_residence_portal_lead_cards") &&
 (landlord.match(/security_barrier=true,security_invoker=true/g)||[]).length>=2,
 "Existing landlord portal views are RLS invokers with preserved read paths");
pass(landlord.includes("rk_sync_portal_application_card") &&
 landlord.includes("rk_sync_portal_lead_card") &&
 landlord.includes("rk_refresh_portal_profile_cards"),
 "Application, lead and student academic updates synchronise their limited permitted projections");
pass(!landlord.includes("contact_phone") && !landlord.includes("contact_email") &&
 !landlord.includes("identity_number") && !landlord.includes("phone_number") &&
 !landlord.includes("grant select on public.residence_leads to authenticated"),
 "Landlord projections never copy direct contact data or expand base-table read privileges");
pass(landlord.includes("revoke all on public.rk_residence_portal_application_cards") &&
 landlord.includes("revoke all on public.rk_residence_portal_lead_cards") &&
 landlord.includes("for select to authenticated"),
 "Safe projection tables have no public mutation privileges and only scoped authenticated reads");

pass(ownership.includes("_user_id=auth.uid()") &&
 ownership.includes("auth.uid() is not null") &&
 ownership.includes("auth.role()='service_role'") &&
 ownership.includes("from public,anon,authenticated"),
 "Anonymous or cross-account is_application_owner probes are blocked");
pass(ownership.includes("new.status not in('under_review','documents_required')") &&
 ownership.includes("to_jsonb(new)-array['notes','status','updated_at']") &&
 ownership.includes("old.status in('approved','conditionally_approved','rejected','withdrawn'"),
 "Landlord may add review feedback but cannot forge decisions, move applicants or alter other fields");
pass(ownership.includes("public.is_authorized_residence_user(old.residence_id)") &&
 ownership.includes("auth.uid() is null") &&
 ownership.includes("has_admin_department_access('accommodation')"),
 "Landlord writes require real assignment; existing controlled internal staff/service actions persist");
pass(ownership.includes("revoke all on table public.handover_remediation_queue_v from public,anon") &&
 ownership.includes("revoke all on table public.residence_handover_export_v from public,anon"),
 "Identity-bearing handover exports are not granted anonymous access");

for(const [p,surface] of [
 ["src/pages/RoommateFinder.tsx","roommate_profiles_public_v"],
 ["src/pages/RecruiterDashboard.tsx","recruitable_residences_v"],
 ["src/pages/residence/ResidenceInbox.tsx","residence_portal_applications_safe"],
 ["src/pages/residence/ResidenceCRM.tsx","residence_portal_leads_safe"],
 ["src/pages/residence/ResidenceApplicationDetail.tsx","residence_portal_applications_safe"]
])pass(read(p).includes(surface),"Unchanged "+p+" continues to use the same limited view contract");
console.log("SEC-03–SEC-06 privilege and RLS scope regression guards passed.");
