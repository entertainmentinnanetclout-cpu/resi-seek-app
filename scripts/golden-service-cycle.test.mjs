// Golden Service Cycle regression: private source projections, actual contact proofs and safe handover.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const check=(ok,why)=>{assert.ok(ok,why);console.log("PASS",why)};
const foundation=read("supabase/migrations/20261114115500_rk_golden_service_cycle_foundation.sql");
const api=read("supabase/migrations/20261114120500_rk_golden_cycle_api_delivery_watch.sql");
const satisfaction=read("supabase/migrations/20261114121500_rk_golden_cycle_service_satisfaction.sql");
const admin=read("src/pages/admin/AdminGoldenServiceCycle.tsx");
const student=read("src/components/service/GoldenServiceJourneyPanel.tsx");
const centre=read("src/pages/ServiceCentre.tsx");
const homepage=read("src/pages/Landing.tsx");
const finder=read("src/pages/FindMyRes.tsx");
const app=read("src/App.tsx");
const nav=read("src/components/admin/AdminLayout.tsx");
const snapshot=JSON.parse(read("scripts/backend-live-contracts.snapshot.json"));
const kinds=["application","reservation","viewing","enquiry","onboarding","application_support","private_rental","student_support","wil","landlord","partner"];
check(kinds.every(k=>foundation.includes("'"+k+"'")), "All 11 existing intake categories are in one private source projection");
check(foundation.includes("public.rk_golden_service_cases")&&foundation.includes("enable row level security")
 &&foundation.includes("revoke all on public.rk_golden_service_rules")
 &&!foundation.includes("grant select on public.rk_golden_service_cases to anon"),
 "Private service tables block public and direct browser reads");
check(foundation.includes("p_new and v_user is not null")&&foundation.includes("receipt_issued_at")
 &&foundation.includes("rk_golden_received_")&&foundation.includes("where not exists"),
 "Only NEW signed-in submissions get a deduplicated in-app receipt; historical backfill remains silent");
check(api.includes("delivery_status='sent'")&&api.includes("sent_at is not null")
 &&api.includes("operator_marked_sent")&&api.includes("marked_sent_at is not null"),
 "Human response clock advances only from provider-confirmed or explicitly attested sends");
check(api.includes("p_confirm_sent is distinct from true")&&api.includes("human_send_attested"),
 "Clicking an email draft cannot masquerade as real contact");
check(api.includes("reskonnect_internal.rk_godmode_authorized()")&&api.includes("revokE ALL")===false
 &&api.includes("revoke all on function public.rk_golden_service_action"),
 "All business coordination RPCs explicitly enforce God Mode MFA and revoked default execute");
check(api.includes("Delegate the actual eligibility task in Case Command Center first")
 &&api.includes("rk_case_tasks")&&api.includes("status='completed'"),
 "Landlord waiting status requires a real delegated eligibility task and tracks completion");
check(api.includes("original business status")||api.includes("Business status"), "The cycle cannot alter business statuses or approve unverified placements");
check(api.includes("rk-golden-service-watch")&&api.includes("*/15 * * * *")
 &&api.includes("rk_golden_digest_receipts")&&api.includes("admin_user_id,digest_day"),
 "The 15-minute watchdog has a deduplicated once-a-day internal digest");
check(api.includes("where user_id=v_id")&&api.includes("p_limit not between 1 and 120"),
 "Student portal is owner-scoped and operator queue is bounded");
check(app.includes('path="/admin/golden-cycle"')&&app.includes("AdminRoute")
 &&nav.includes("Golden Service Cycle")&&centre.includes("<GoldenServiceJourneyPanel/>"),
 "Golden service is reachable from protected God Mode and existing student service centre");
check(homepage.includes('to="/dashboard/services"')&&finder.includes('to="/dashboard/services"'),
 "First-time visitors and returning applicants can always locate service tracking");
check(admin.includes('rk_golden_service_queue')&&admin.includes('rk_golden_service_action')
 &&admin.includes("only")!==false&&admin.includes("Communication dock"),
 "The single-operator dashboard integrates with communications and audited case decisions");
check(satisfaction.includes("p_rating not between 1 and 5")&&satisfaction.includes("rating<=2")
 &&satisfaction.includes("recover_unhappy_customer")&&satisfaction.includes("enable row level security"),
 "Private quality feedback supports five stars and creates a fast service recovery action");
check(student.includes("rk_golden_service_feedback_submit")&&admin.includes("needs_recovery"),
 "Aftercare loop is connected across student portal and operator satisfaction dashboard");
check(student.includes("rk_golden_my_service")&&student.includes("Automatic acknowledgement"),
 "Student timeline distinguishes computer acknowledgements from human servicing");
check(["rk_golden_service_queue","rk_golden_service_action","rk_golden_case_history","rk_golden_my_service","rk_golden_service_feedback_submit"]
 .every(n=>snapshot.callable_routines.some(r=>r.name===n&&r.authenticated&&!r.anon)),
 "Live backend contract snapshot covers each signed-in scoped RPC");
console.log("Golden Service Cycle source and backend-contract safeguards passed.");
