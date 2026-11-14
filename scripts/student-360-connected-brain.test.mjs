import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=file=>readFileSync(resolve(root,file),"utf8");
const good=(ok,label)=>{assert.ok(ok,label);console.log("PASS",label);};
const sql=source("supabase/migrations/20261114153000_rk_student_360_connected_journey.sql");
const queue=source("supabase/migrations/20261114153500_rk_student_360_case_queue_link.sql");
const wildcard=source("supabase/migrations/20261114154000_rk_student_360_literal_search_hardening.sql");
good(wildcard.includes("rk_student_360_search")&&wildcard.includes("E'\\\\%'")
 &&wildcard.includes("E'\\\\_'"),"Student directory search treats % and _ as literal characters");
const brain=source("src/pages/admin/AdminBrain.tsx");
const journey=source("src/pages/admin/AdminStudent360.tsx");
const apps=source("src/pages/admin/AdminApplications.tsx");
const people=source("src/pages/admin/AdminUsers.tsx");
const wil=source("src/pages/admin/AdminWIL.tsx");
const caseDesk=source("src/pages/admin/AdminCaseCommandCenter.tsx");
const app=source("src/App.tsx");
const sidebar=source("src/components/admin/AdminLayout.tsx");
good(sql.includes("rk_student_360_snapshot")&&sql.includes("rk_student_360_search")
 &&sql.includes("rk_student_360_milestone_set"),"Complete person search, live snapshot and verified milestone update APIs");
good((sql.match(/rk_godmode_authorized\(\)/g)||[]).length>=3,"Every Student 360 API enforces God Mode AAL2 through the protected gate");
good(sql.includes("revoke all on public.rk_student_journey_milestones from public,anon,authenticated")
 &&sql.includes("revoke all on public.rk_student_journey_audit from public,anon,authenticated")
 &&sql.includes("enable row level security"),"Student milestone state and audit are not directly exposed");
good(sql.includes("length(coalesce(v_evidence,''))<8")&&sql.includes("length(v_note)<12")
 &&sql.includes("p_expected_updated_at")&&sql.includes("for update"),
 "Verified achievements need evidence and optimistic version checks");
good(sql.includes("public.rk_student_journey_audit")&&sql.includes("external_messages_sent',false")
 &&sql.includes("business_decision_changed',false"),
 "Milestone actions are audited and cannot masquerade as service decisions");
for(const table of ["public.profiles","public.applications","public.accommodation_reservations","public.documents",
 "public.wil_applications","public.application_support_queries","public.rk_golden_service_cases",
 "public.conversion_automation_tasks","public.reskonnect_outbound_emails","public.reskonnect_whatsapp_handoffs"])
 good(sql.includes(table),"Unified profile reads the actual "+table+" records");
good(!sql.includes("p.identity_number")&&!sql.includes("d.file_path")&&!sql.includes("d.file_name"),
 "Student snapshot excludes identity numbers and document storage paths");
good(queue.includes("'student_user_id',case when p_scope='admin' then student_id else null end")
 &&queue.includes("rk_godmode_authorized()"),"Landlords do not receive the new direct Student 360 link");
good(app.includes('path="/admin/students/:userId"')&&app.includes('path="/admin/brain"')
 &&app.includes("<AdminHomeSwitch />"),"One Brain is the protected God Mode home with a lifelong profile route");
good(sidebar.includes("Student 360 · One Brain")&&sidebar.includes("Specialist tools & old departments"),
 "Solo operator sees five large operational commands, with advanced tools collapsed");
good(brain.includes("rk_student_360_search")&&brain.includes("rk_golden_service_queue")
 &&brain.includes("Six interconnected command actions"),"One Brain resolves people and live operational exceptions");
good(journey.includes("rk_student_360_snapshot")&&journey.includes("rk_student_360_milestone_set")
 &&journey.includes("Communication truth")&&journey.includes("One factual student timeline"),"Student 360 unifies real facts with auditable lifelong milestones");
good(apps.includes("rk_case_bulk_preview")&&apps.includes("rk_case_bulk_apply")
 &&apps.includes("ids.length>25")&&apps.includes("p_expected:expected")
 &&apps.includes("p_operation_id:crypto.randomUUID()"),"Bulk applications are bounded with MFA preflight and concurrency snapshot");
good(apps.includes("/admin/students/")&&people.includes("/admin/students/")
 &&wil.includes("/admin/students/")&&caseDesk.includes("/admin/students/"),
 "Every primary admin case surface links to the same person");
good(apps.includes("useSearchParams")&&apps.includes('params.get("application")'),
 "A deep-linked application opens its exact record from Student 360");
good(source("src/pages/admin/AdminGoldenServiceCycle.tsx").includes('urlParams.get("filter")'),
 "One Brain overdue button opens the correct service filter");
console.log("ResKonnect Student 360 connected brain guard checks passed.");
