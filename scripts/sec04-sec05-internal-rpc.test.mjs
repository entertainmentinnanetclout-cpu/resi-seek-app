import { strict as assert } from "node:assert";
import {readFileSync,readdirSync,statSync} from "node:fs";
import {dirname,resolve,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>readFileSync(resolve(root,p),"utf8");
const verify=(predicate,what)=>{assert.ok(predicate,what);console.log("PASS",what);};
const sql=read("supabase/migrations/20261114230000_sec04_sec05_internal_rpc_boundaries.sql");
const snapshot=JSON.parse(read("scripts/backend-live-contracts.snapshot.json"));
const serviceOnly=[
 "adminos_generate_executive_brief(date)",
 "adminos_generate_proactive_notifications()",
 "adminos_record_agent_feedback(uuid,uuid,uuid,text,boolean,integer,text,text,jsonb)",
 "adminos_record_csat(uuid,integer,uuid,text,text)",
 "adminos_record_learning_gap(text,uuid,uuid,text,text,jsonb)",
 "adminos_refresh_next_best_actions()",
 "adminos_refresh_service_metrics(date)",
 "adminos_refresh_service_recovery()",
 "adminos_set_contact_language(uuid,text,text,numeric)",
 "adminos_touch_whatsapp_conversion(uuid,uuid,uuid,text,text,jsonb)",
 "dimpho_compile_persona(uuid)",
 "dimpho_search_knowledge(text,text,integer,numeric)",
];
verify(serviceOnly.length===12 && new Set(serviceOnly).size===12,
 "Exactly twelve unique internal-only privileged functions selected");
for(const sig of serviceOnly){
 const name=sig.split("(")[0];
 verify(sql.includes("REVOKE EXECUTE ON FUNCTION public."+sig+" FROM PUBLIC, anon, authenticated;")
     &&sql.includes("GRANT EXECUTE ON FUNCTION public."+sig+" TO service_role;"),
     "Remove public and signed-in EXECUTE, retain service-only access: "+name);
 const ref=snapshot.callable_routines.filter(x=>x.name===name);
 verify(ref.length===1&&ref[0].anon===false&&ref[0].authenticated===false,
     "Production function contract stays service-only: "+name);
}
verify(sql.includes("CREATE OR REPLACE FUNCTION public.dimpho_intelligence_overview()")
 &&sql.includes("coalesce(public.adminos_is_staff(),false)")
 &&sql.includes("RAISE EXCEPTION 'Privileged staff MFA required'"),
 "Dimpho Intelligence Studio checks actual staff MFA inside its protected RPC");
verify(sql.includes("CREATE OR REPLACE FUNCTION public.validate_handover_pack")
 &&sql.includes("Privileged staff MFA required"),
 "Student handover audit requires actual staff MFA");
verify(sql.includes("CREATE OR REPLACE FUNCTION public.virtual_tour_publish_readiness")
 &&sql.includes("public.virtual_tour_can_manage_tour(p_tour_id)")
 &&sql.includes("auth.role() is distinct from 'service_role'"),
 "Tour readiness requires actual owner/residence permission, but still permits trusted service");
verify(read("src/components/admin/DimphoIntelligenceStudio.tsx").includes('.rpc("dimpho_intelligence_overview")'),
 "Existing protected admin studio UI still uses the stable RPC");
verify(read("src/lib/virtualTours/api.ts").includes('db.rpc("virtual_tour_publish_readiness"'),
 "Existing tour studio retains its unchanged caller-scoped RPC");
const types=read("supabase/functions/adminos-whatsapp-webhook/index.ts");
verify(types.includes('adminos_set_contact_language') && types.includes('adminos_record_csat'),
 "Webhook service flow retains the internal-language and CSAT RPC consumers");
const agent=read("supabase/functions/adminos-agent/index.ts");
verify(agent.includes('dimpho_search_knowledge') && agent.includes('adminos_record_learning_gap'),
 "AI agent service flow retains internal-knowledge and learning RPC consumers");
const srcNames=[];
function sourceWalk(dir){
 for(const d of readdirSync(dir,{withFileTypes:true})){
  const f=join(dir,d.name);
  if(d.isDirectory())sourceWalk(f);
  else if(/\.(tsx?|jsx?)$/.test(d.name) && !d.name.includes("generated")){
   const content=readFileSync(f,"utf8");
   const match=content.match(/\.rpc\s*\(\s*["']([^"']+)["']/g)||[];
   for(const item of match)srcNames.push({file:f,name:item.replace(/^[\s\S]*?["']([^"']+)["'].*/,"$1")});
  }
 }
}
sourceWalk(resolve(root,"src"));
const blocked=new Set(serviceOnly.map(s=>s.split("(")[0]));
const bad=srcNames.filter(x=>blocked.has(x.name));
verify(bad.length===0,
 "No direct browser .rpc call targets a newly service-only endpoint ("+bad.map(x=>x.name).join(",")+")");
console.log("SEC-04/SEC-05 permission boundary regression suite passed; live role checks still required.");
