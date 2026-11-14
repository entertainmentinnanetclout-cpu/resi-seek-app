// Golden daily flight deck: read-only workload facts and safe routing for one operator.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const check=(condition,why)=>{assert.ok(condition,why);console.log("PASS",why);};
const sql=read("supabase/migrations/20261114142000_rk_golden_solo_operator_workload_pulse.sql");
const admin=read("src/pages/admin/AdminGoldenServiceCycle.tsx");
check(sql.includes("rk_godmode_authorized()")
 &&sql.toLowerCase().includes("security definer")&&sql.includes("revoke all on function public.rk_golden_service_queue")
 &&sql.includes("to authenticated"),"Existing queue MFA and direct-data denial remain intact");
for(const field of ["pending_documents","pending_documents_older_48h","pending_application_documents",
 "delegated_residence_open","residence_recommendations_pending","wil_open","partner_open"])
 check(sql.includes("'"+field+"'"),"Scoped operator count exists: "+field);
check(sql.includes("public.documents d")&&sql.includes("d.verified_at is null")
 &&sql.includes("public.application_documents d"),"Pending documents are not falsely counted as reviewed");
check(sql.includes("w.handover_approved_at is null")&&sql.includes("t.status='completed'")
 &&sql.includes("t.task_type='eligibility_review'"),
 "Residence handover counters distinguish unfinished sign-off");
check(sql.includes("public.rk_golden_service_cases s")&&sql.includes("s.closed_at is null"),
 "WIL and partner counters exclude closed service cases");
check(!sql.includes("insert into public.notifications")&&!sql.includes("update public.documents")
 &&!sql.includes("update public.applications"),"Workload pulse cannot auto-send or make decisions");
check(admin.includes("Daily mission control")&&admin.includes("sprintCards.map")
 &&admin.includes("Counts are factual workload indicators"),"Visual solo operator flight deck is rendered");
for(const route of ["/admin/communications?tab=email","/admin/documents","/admin/cases","/admin/wil","/admin/partnerships","/admin/onboarding"])
 check(admin.includes(route),"Hand-off destination exists in flight deck: "+route);
check(admin.includes("No external messages or business decisions are made here.")
 &&admin.includes("A draft is not a delivery."),
 "Bulk triage and communication boundaries remain visible");
check(admin.includes('setFilter("post_service");setKind("all");setOffset(0);setSelected(null);'),
 "Aftercare action opens the actual post-service queue, not the new intake default");
console.log("Golden daily mission control guard checks passed.");
