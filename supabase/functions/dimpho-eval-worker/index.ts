import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const env=(n:string)=>Deno.env.get(n)||"";
const url=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const sk=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anon=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const service=url&&sk?createClient(url,sk,{auth:{persistSession:false}}):null;
const lower=(v:any)=>String(v||"").toLowerCase();

async function authorized(req:Request){
  const auth=req.headers.get("Authorization")||"";
  if(auth===`Bearer ${sk}`)return{ok:true,userId:null,internal:true};
  const c=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const u=(await c.auth.getUser()).data?.user;
  if(!u)return{ok:false,userId:null,internal:false};
  const r=await service!.rpc("get_user_staff_role",{_user_id:u.id});
  return{ok:Boolean(r.data),userId:u.id,internal:false};
}

function canonicalLinksOnly(answer:string){
  const matches=answer.match(/https?:\/\/[^\s<>)\]}]+/gi)||[];
  return matches.every((raw)=>{try{const u=new URL(raw.replace(/[.,;:!?]+$/g,""));return u.protocol==="https:"&&u.hostname==="www.reskonnect.org";}catch{return false;}});
}

function evaluate(caseRow:any,response:any){
  const a=caseRow.assertions||{};
  const answer=String(response?.answer||"");
  const text=lower(answer);
  const reasons:string[]=[];
  let pass=true;
  const contains=(x:string)=>text.includes(lower(x));
  if(Array.isArray(a.must_contain_any)&&a.must_contain_any.length&&!a.must_contain_any.some(contains)){pass=false;reasons.push("missing required content");}
  if(Array.isArray(a.must_not_contain))for(const x of a.must_not_contain)if(contains(x)){pass=false;reasons.push(`contained forbidden phrase: ${x}`);}
  if(typeof a.must_escalate==="boolean"&&Boolean(response?.escalate)!==a.must_escalate){pass=false;reasons.push(`escalate expected ${a.must_escalate}`);}
  if(a.min_confidence!==undefined&&Number(response?.confidence||0)<Number(a.min_confidence)){pass=false;reasons.push("confidence below assertion");}
  if(a.canonical_links_only===true&&!canonicalLinksOnly(answer)){pass=false;reasons.push("non-canonical link");}
  const toolKeys=Array.isArray(response?.tool_keys)?response.tool_keys:Array.isArray(response?.tools_used)?response.tools_used:[];
  if(caseRow.expected_tool&&!toolKeys.includes(caseRow.expected_tool)){pass=false;reasons.push(`expected tool not used: ${caseRow.expected_tool}`);}
  return{passed:pass,score:pass?1:0,reasons,toolKeys};
}

async function invokeAgent(caseRow:any){
  const started=Date.now();
  const r=await fetch(`${url}/functions/v1/adminos-agent`,{method:"POST",headers:{Authorization:`Bearer ${sk}`,apikey:sk,"Content-Type":"application/json"},body:JSON.stringify({action:caseRow.action||"public_enquiry",message:caseRow.prompt,context:{...(caseRow.context||{}),channel:"eval",eval_case_key:caseRow.case_key},evaluation:true})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.detail||data?.error||`agent HTTP ${r.status}`);
  return{data,latency:Date.now()-started};
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!service||!anon)return json({error:"Runtime not configured"},500);
  const who=await authorized(req);
  if(!who.ok)return json({error:"Staff access required"},403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"health");
  if(action==="health"){
    const gate=await service.rpc("dimpho_latest_eval_gate",{p_suite_key:"production_gate"});
    return json({ok:true,release:7,latest_gate:gate.data||{}});
  }
  if(action!=="run_suite"&&action!=="latest_gate")return json({error:"Unknown action"},400);
  if(action==="latest_gate"){
    const gate=await service.rpc("dimpho_latest_eval_gate",{p_suite_key:String(body.suite_key||"production_gate")});
    return json({ok:true,gate:gate.data||{}});
  }
  const suiteKey=String(body.suite_key||"production_gate");
  const {data:suite,error:se}=await service.from("dimpho_eval_suites").select("*").eq("suite_key",suiteKey).eq("status","active").maybeSingle();
  if(se||!suite)return json({error:"Evaluation suite not found"},404);
  const {data:cases,error:ce}=await service.from("dimpho_eval_cases").select("*").eq("suite_id",suite.id).eq("enabled",true).order("case_key");
  if(ce)return json({error:ce.message},500);
  const run=await service.from("dimpho_eval_runs").insert({suite_id:suite.id,status:"running",total_cases:(cases||[]).length,model_key:body.model_key||"live-router",model_name:body.model_name||null,commit_sha:body.commit_sha||null,agent_release:8,triggered_by:who.userId,metadata:{source:"dimpho-eval-worker",release:7}}).select("id").single();
  if(run.error)return json({error:run.error.message},500);
  let passed=0,failed=0,weighted=0,totalWeight=0;
  for(const c of cases||[]){
    let resp:any={},latency=0,out:any;
    try{const call=await invokeAgent(c);resp=call.data;latency=call.latency;out=evaluate(c,resp);}
    catch(e){out={passed:false,score:0,reasons:[e instanceof Error?e.message:String(e)],toolKeys:[]};resp={error:out.reasons[0]};}
    const w=Number(c.weight||1);totalWeight+=w;weighted+=Number(out.score||0)*w;if(out.passed)passed++;else failed++;
    await service.from("dimpho_eval_results").insert({run_id:run.data.id,case_id:c.id,passed:out.passed,score:out.score,answer:String(resp?.answer||"").slice(0,6000)||null,confidence:resp?.confidence??null,risk:resp?.risk||null,escalated:Boolean(resp?.escalate),tool_keys:out.toolKeys,reasons:out.reasons,latency_ms:latency,response:{run_id:resp?.run_id||null,provider:resp?.provider||null,model:resp?.model||null,reason:resp?.reason||null}});
  }
  const score=totalWeight?weighted/totalWeight:0;
  const gatePassed=score>=Number(suite.gate_threshold||.9)&&failed===0;
  await service.from("dimpho_eval_runs").update({status:gatePassed?"passed":"failed",score,passed_cases:passed,failed_cases:failed,gate_passed:gatePassed,completed_at:new Date().toISOString()}).eq("id",run.data.id);
  return json({ok:true,run_id:run.data.id,score,passed,failed,total:(cases||[]).length,gate_threshold:suite.gate_threshold,gate_passed:gatePassed});
});
