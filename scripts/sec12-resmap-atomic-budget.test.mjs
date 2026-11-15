import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname,resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const sql=read("supabase/migrations/20261115075500_sec12_resmap_atomic_ai_budgets.sql");
const spatial=read("supabase/functions/resmap-spatial/index.ts");
const visual=read("supabase/functions/resmap-visual-search/index.ts");
const pass=(ok,msg)=>{assert.ok(ok,msg);console.log("PASS",msg)};

pass(sql.includes("create or replace function public.rk_consume_ai_budget(") &&
 sql.includes("auth.role() is distinct from 'service_role'") &&
 sql.includes("revoke all on function public.rk_consume_ai_budget(text,text,boolean) from public,anon,authenticated") &&
 sql.includes("grant execute on function public.rk_consume_ai_budget(text,text,boolean) to service_role"),
 "Atomic AI budget endpoint is service-only and denied to browser roles");
pass(sql.includes("reskonnect_internal.rk_public_rpc_budgets") &&
 sql.includes("on conflict(surface,bucket_start,identity_hash) do update") &&
 sql.includes("where reskonnect_internal.rk_public_rpc_budgets.used < v_rule.quota") &&
 sql.includes("errcode='PT429'"),
 "Budget counters are private, concurrency-safe and produce a 429 when exhausted");
pass(sql.includes("'d:' || v_identity") &&
 sql.includes("'global-m'") && sql.includes("'global-h'") &&
 sql.includes("v_day_limit := case when p_verified_user then 10 else 3 end") &&
 sql.includes("v_global_hour := 60") &&
 sql.includes("v_global_hour := 360"),
 "Per-day actor budgets and global minute/hour spend circuits cover rotating guest IDs");
pass(spatial.includes('service.rpc("rk_consume_ai_budget",{p_surface:"map_intent"') &&
 spatial.indexOf('service.rpc("rk_consume_ai_budget"') < spatial.indexOf('fetch("https://api.openai.com/v1/responses"') &&
 spatial.includes("return json({error:message},message.includes(\"limit reached\")?429"),
 "Map AI intent requests consume atomic budget before paid provider calls");
pass(visual.includes('service.rpc("rk_consume_ai_budget"') &&
 visual.indexOf('service.rpc("rk_consume_ai_budget"') < visual.indexOf('fetch("https://api.openai.com/v1/responses"') &&
 visual.includes('p_verified_user:Boolean(userId)'),
 "Visual image AI requests consume user/guest budget before paid provider calls");
pass(read("package.json").includes("node scripts/sec12-resmap-atomic-budget.test.mjs"),
 "Budget regression is included in mandatory backend CI contracts");
console.log("SEC-12/36 ResMap API abuse prevention: static contract checks passed. Live role/budget acceptance required.");
