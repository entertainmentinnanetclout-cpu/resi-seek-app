// Golden Service Cycle bulk coordination release gate.
// All actions are internal; protected case decisions, actual sends and documents remain separate.
import {readFileSync} from "node:fs";
import {strict as assert} from "node:assert";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const sql=read("supabase/migrations/20261114130000_rk_golden_safe_bulk_triage.sql");
const admin=read("src/pages/admin/AdminGoldenServiceCycle.tsx");
const check=(condition,message)=>{assert.ok(condition,message);console.log("PASS",message);};
check(sql.includes("reskonnect_internal.rk_godmode_authorized()")
 &&sql.includes("security definer set search_path = ''")
 &&sql.includes("revoke all on function public.rk_golden_bulk_triage")
 &&sql.includes("to authenticated"),"Bulk RPC is God Mode MFA-gated with least-privilege public grants");
check(sql.includes("jsonb_array_length(p_items) not between 1 and 20")
 &&sql.includes("length(p_items::text) > 12000")
 &&sql.includes("Duplicate service case in batch"),"Bulk input is bounded and rejects duplicate cases");
check(sql.includes("p_action not in ('begin_review', 'set_followup', 'private_note')")
 &&!sql.includes("'contact_confirmed'")&&!sql.includes("'complete_cycle'"),
 "Bulk commands cannot confirm fake contact, close services or make decisions");
check(sql.includes("for update")&&sql.includes("is distinct from v_expected_status")
 &&sql.includes("is distinct from v_expected_step")
 &&sql.includes("v_closed_at is not null"),"All selected cases must be open, fresh and row-locked");
check(sql.includes("public.rk_golden_service_action(")
 &&sql.includes("null, false, v_expected_status")
 &&sql.includes("'messages_sent', false"),"Every batch entry uses the existing audited action without external sends");
check(admin.includes('rpc("rk_golden_bulk_triage"')
 &&admin.includes("batchSelected.map(item=>({kind:item.kind,id:item.id,status:item.status,step:item.step}))")
 &&admin.includes("setBatchKeys([])")&&admin.includes("disabled={Boolean(row.closed_at)||batchBusy}"),
 "Frontend selects only open, current page cases and sends optimistic concurrency keys");
check(admin.includes("No external messages or business decisions")
 &&admin.includes("Unanswered cases remain unanswered")
 &&admin.includes("window.confirm"),"Batch UX explicitly preserves review, contact and final approval boundaries");
console.log("Golden Service safe-bulk regression checks passed.");
