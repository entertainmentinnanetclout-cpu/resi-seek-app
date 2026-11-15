import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const pass=(v,msg)=>{assert.ok(v,msg);console.log("PASS",msg);};
const budgets=read("supabase/migrations/20261115072500_sec04_public_rpc_budgets_and_guard.sql");
const rpc=read("supabase/migrations/20261115073000_sec04_referral_attribution_telemetry_bounded.sql");
const funcs=[
 ["capture_referral_click","referral_click"],
 ["capture_residence_referral_click",null],
 ["luna_capture_attribution","growth_attribution"],
 ["luna_log_demand_event","growth_demand"],
 ["record_mobile_runtime_event","mobile_runtime"],
 ["record_virtual_tour_event","virtual_tour_event"]
];
pass(budgets.includes("reskonnect_internal.rk_public_rpc_budgets")&&budgets.includes("enable row level security") &&
 budgets.includes("revoke all on table reskonnect_internal.rk_public_rpc_budgets from PUBLIC,anon,authenticated") &&
 !budgets.includes("GRANT SELECT ON TABLE"),
 "Budget ledger is in a private schema, RLS enabled, no public database grants");
pass(budgets.includes("rk_guard_public_rpc_budget") &&
 budgets.includes("on conflict(surface,bucket_start,identity_hash) do update") &&
 (budgets.match(/when errcode='PT429'|using errcode='PT429'/g)||[]).length>=3 &&
 budgets.includes("'global'"),
 "Per-minute, per-hour and global budgets use atomic conflict updates and 429 failures");
pass(budgets.includes("md5(coalesce(auth.uid()::text") &&
 budgets.includes("Anonymous browser IDs are untrusted heuristics"),
 "Authenticated quota uses auth.uid; anonymous session tokens explicitly treated as spoofable");
pass(budgets.includes("rk-public-rpc-budget-prune") &&
 budgets.includes("interval '48 hours'"),
 "Bounded counters have a named scheduled two-day cleanup");
for(const [fn,budget] of funcs){
 pass(rpc.includes("CREATE OR REPLACE FUNCTION public."+fn+"("),
  "Existing ABI-preserving public RPC is hardened: "+fn);
 if(budget)pass(rpc.includes("'"+budget+"'")&&rpc.includes("reskonnect_internal.rk_guard_public_rpc_budget"),
  "Public tracking RPC includes budget enforcement for "+budget);
}
pass(rpc.includes("octet_length(coalesce(_visitor_id,''))>128") &&
 rpc.includes("octet_length(coalesce(_landing_url,''))>900") &&
 rpc.includes("octet_length(coalesce(_user_agent,''))>600"),
 "Referral click inputs have explicit size caps before writes");
pass(rpc.includes("if v_session is null then return null; end if;"),
 "Residence recruiter click cannot emit events without a valid captured referral session");
pass(rpc.includes("where adminos_attribution_sessions.visitor_hash=excluded.visitor_hash") &&
 rpc.includes("adminos_attribution_sessions.user_id=excluded.user_id"),
 "Attribution upsert cannot claim a different actor's existing session");
pass(rpc.includes("visitor_hash=left(p_visitor_hash,128)") &&
 rpc.includes("and (user_id is null or user_id=v_uid)"),
 "Later demand events cannot silently attach unrelated attribution sessions");
pass(rpc.includes("octet_length(coalesce(p_payload,'{}'::jsonb)::text)>8192") &&
 rpc.includes("octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>4096"),
 "Demand and tour metadata are bounded before privileged writes");
pass(rpc.includes("where id=p_scene_id and tour_id=p_tour_id"),
 "Tour scene analytics cannot refer to an unrelated tour");
pass(rpc.includes("record_mobile_runtime_event") &&
 rpc.includes("case when auth.uid() is null then 2000 else 30 end"),
 "Anonymous crash telemetry remains allowed with a coarse fallback budget");
pass(read("src/lib/lunaGrowth.ts").includes('.rpc("luna_capture_attribution"') &&
 read("src/lib/lunaGrowth.ts").includes('.rpc("luna_log_demand_event"'),
 "Growth tracking frontend retains both original RPC names");
pass(read("src/pages/ResidenceRecruiterRedirect.tsx").includes('.rpc("capture_residence_referral_click"') &&
 read("src/lib/referrals/referralApi.ts").includes('rpc("capture_referral_click"'),
 "Referral redirects and generic referrals retain their original RPC names");
pass(read("src/lib/virtualTours/api.ts").includes('db.rpc("record_virtual_tour_event"'),
 "Existing virtual tour analytics caller remains compatible");
console.log("SEC-04 public telemetry: static contract and abuse controls passed. Live SQL role-negative tests are separately required.");
