import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const env=(n:string)=>Deno.env.get(n)||"";
const url=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const sk=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anon=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const openaiKey=env("OPENAI_API_KEY");
const service=url&&sk?createClient(url,sk,{auth:{persistSession:false}}):null;

async function authorized(req:Request){
  const auth=req.headers.get("Authorization")||"";
  if(auth===`Bearer ${sk}`)return{ok:true,userId:null,internal:true};
  const c=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const u=(await c.auth.getUser()).data?.user;
  if(!u)return{ok:false,userId:null,internal:false};
  const r=await service!.rpc("get_user_staff_role",{_user_id:u.id});
  return{ok:Boolean(r.data),userId:u.id,internal:false};
}

async function sha256(text:string){
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b)=>b.toString(16).padStart(2,"0")).join("");
}

async function getRoute(routeKey:string){
  const r=await service!.rpc("dimpho_model_router_snapshot",{p_route_key:routeKey});
  return r.data&&Object.keys(r.data).length?r.data:null;
}

async function recordRoute(route:any,body:any){
  if(!route)return;
  await service!.from("dimpho_router_decisions").insert({agent_run_id:body.agent_run_id||null,route_key:route.route_key,model_id:route.model_id||null,provider:route.provider||null,model_name:route.model_name||null,reason:body.reason||"Model router request",input_summary:{complexity:body.complexity||null,channel:body.channel||null,risk:body.risk||null}});
}

async function freezeDataset(userId:string|null,body:any){
  const created=await service!.rpc("dimpho_create_dataset_release",{p_name:body.name||null});
  if(created.error)throw created.error;
  const release=created.data;
  const {data:examples,error}=await service!.from("dimpho_training_examples").select("id,category,channel,user_input,ideal_output,tags,quality_score,provenance").eq("active",true).gte("quality_score",Number(body.min_quality||0.8)).order("quality_score",{ascending:false}).limit(Math.max(1,Math.min(Number(body.limit||5000),10000)));
  if(error)throw error;
  const lines=(examples||[]).map((x:any)=>JSON.stringify({messages:[{role:"system",content:"You are Dimpho, ResKonnect's AI Concierge. Use verified ResKonnect context, never invent operational facts, and escalate when required."},{role:"user",content:x.user_input},{role:"assistant",content:x.ideal_output}],metadata:{category:x.category,channel:x.channel,tags:x.tags,quality_score:x.quality_score,provenance:x.provenance}}));
  const text=lines.join("\n")+(lines.length?"\n":"");
  const checksum=await sha256(text);
  const version=release?.version||Date.now();
  const path=`datasets/v${version}/training-${checksum.slice(0,12)}.jsonl`;
  const upload=await service!.storage.from("dimpho-model-artifacts").upload(path,new Blob([text],{type:"application/jsonl"}),{upsert:true,contentType:"application/jsonl"});
  if(upload.error)throw upload.error;
  if(release?.id)await service!.from("dimpho_dataset_releases").update({checksum,example_count:lines.length,status:"frozen",frozen_at:new Date().toISOString(),metadata:{...(release.metadata||{}),artifact_path:path,format:"openai_chat_jsonl",release:8}}).eq("id",release.id);
  return{dataset_release_id:release?.id||null,version,example_count:lines.length,checksum,artifact_path:path};
}

async function submitFineTune(userId:string|null,body:any){
  if(body.confirm_cost!==true||String(body.cost_confirmation||"")!=="AUTHORIZE_FINE_TUNE_COST")throw new Error("Explicit fine-tuning cost authorization required");
  if(!openaiKey)throw new Error("OPENAI_API_KEY is not configured");
  const datasetId=String(body.dataset_release_id||"");
  if(!datasetId)throw new Error("dataset_release_id is required");
  const {data:ds,error}=await service!.from("dimpho_dataset_releases").select("*").eq("id",datasetId).maybeSingle();
  if(error||!ds)throw new Error("Dataset release not found");
  const path=ds.metadata?.artifact_path;
  if(!path)throw new Error("Dataset artifact is missing");
  const download=await service!.storage.from("dimpho-model-artifacts").download(path);
  if(download.error||!download.data)throw new Error("Could not read dataset artifact");
  const training=await service!.from("dimpho_models").select("model_name").eq("model_key","openai_training_base").maybeSingle();
  const baseModel=String(body.base_model||training.data?.model_name||"gpt-4.1-mini");
  const form=new FormData();
  form.append("purpose","fine-tune");
  form.append("file",download.data,`dimpho-rk-v${ds.version}.jsonl`);
  const fr=await fetch("https://api.openai.com/v1/files",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`},body:form});
  const fd=await fr.json().catch(()=>({}));
  if(!fr.ok)throw new Error(fd?.error?.message||`OpenAI file HTTP ${fr.status}`);
  const jr=await fetch("https://api.openai.com/v1/fine_tuning/jobs",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({training_file:fd.id,model:baseModel,suffix:String(body.suffix||"dimpho-rk").slice(0,40)})});
  const jd=await jr.json().catch(()=>({}));
  if(!jr.ok)throw new Error(jd?.error?.message||`OpenAI fine-tune HTTP ${jr.status}`);
  const inserted=await service!.from("dimpho_fine_tune_jobs").insert({dataset_release_id:datasetId,provider:"openai",base_model:baseModel,training_file_id:fd.id,provider_job_id:jd.id,status:jd.status||"submitted",submitted_by:userId,submitted_at:new Date().toISOString(),metadata:{release:8,provider_response:{created_at:jd.created_at||null}}}).select("*").single();
  if(inserted.error)throw inserted.error;
  return inserted.data;
}

async function syncFineTune(body:any){
  if(!openaiKey)throw new Error("OPENAI_API_KEY is not configured");
  let q=service!.from("dimpho_fine_tune_jobs").select("*");
  q=body.job_id?q.eq("id",String(body.job_id)):q.not("provider_job_id","is",null).in("status",["submitted","validating_files","queued","running"]);
  const jobs=(await q.limit(25)).data||[];
  const out=[];
  for(const j of jobs){
    const r=await fetch(`https://api.openai.com/v1/fine_tuning/jobs/${encodeURIComponent(j.provider_job_id)}`,{headers:{Authorization:`Bearer ${openaiKey}`}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){out.push({id:j.id,error:d?.error?.message||`HTTP ${r.status}`});continue;}
    const patch:any={status:d.status||j.status,fine_tuned_model:d.fine_tuned_model||null,updated_at:new Date().toISOString(),metadata:{...(j.metadata||{}),provider_status:d.status||null}};
    if(["succeeded","failed","cancelled"].includes(d.status))patch.completed_at=new Date().toISOString();
    if(d.error)patch.error_message=d.error?.message||String(d.error);
    await service!.from("dimpho_fine_tune_jobs").update(patch).eq("id",j.id);
    if(d.status==="succeeded"&&d.fine_tuned_model){const key=`dimpho_rk_${String(j.id).slice(0,8)}`;await service!.from("dimpho_models").upsert({model_key:key,provider:"openai",model_name:d.fine_tuned_model,display_name:"Dimpho-RK Candidate",purpose:"fine_tuned",capabilities:{responses:true,dimpho_rk:true},fine_tunable:false,status:"candidate",metadata:{fine_tune_job_id:j.id,dataset_release_id:j.dataset_release_id,release:8}},{onConflict:"model_key"});}
    out.push({id:j.id,status:d.status,fine_tuned_model:d.fine_tuned_model||null});
  }
  return out;
}

async function promoteModel(userId:string|null,body:any){
  const modelId=String(body.model_id||"");
  const routeKey=String(body.route_key||"routine");
  if(!modelId)throw new Error("model_id is required");
  const gate=await service!.rpc("dimpho_latest_eval_gate",{p_suite_key:String(body.suite_key||"production_gate")});
  if(!gate.data?.gate_passed)throw new Error("Latest Dimpho evaluation gate has not passed");
  const model=await service!.from("dimpho_models").select("*").eq("id",modelId).maybeSingle();
  if(!model.data)throw new Error("Model not found");
  const prev=await service!.from("dimpho_model_releases").select("id").eq("route_key",routeKey).eq("status","production").order("promoted_at",{ascending:false}).limit(1).maybeSingle();
  const created=await service!.from("dimpho_model_releases").insert({release_key:`${routeKey}-${Date.now()}`,model_id:modelId,route_key:routeKey,eval_run_id:gate.data.run_id||null,status:body.canary===true?"canary":"production",traffic_percent:body.canary===true?Math.max(1,Math.min(Number(body.traffic_percent||10),50)):100,previous_release_id:prev.data?.id||null,promoted_by:userId,promoted_at:new Date().toISOString(),metadata:{release:8,eval_score:gate.data.score}}).select("*").single();
  if(created.error)throw created.error;
  if(body.canary!==true){await service!.from("dimpho_model_routes").update({model_id:modelId,updated_by:userId,updated_at:new Date().toISOString()}).eq("route_key",routeKey);if(prev.data?.id)await service!.from("dimpho_model_releases").update({status:"retired",updated_at:new Date().toISOString()}).eq("id",prev.data.id);}
  await service!.from("dimpho_release_events").insert({release_id:created.data.id,event_type:body.canary===true?"canary_started":"promoted_to_production",actor_user_id:userId,payload:{route_key:routeKey,model_name:model.data.model_name,gate:gate.data}});
  return created.data;
}

async function rollbackModel(userId:string|null,body:any){
  const releaseId=String(body.release_id||"");
  if(!releaseId)throw new Error("release_id is required");
  const rel=await service!.from("dimpho_model_releases").select("*").eq("id",releaseId).maybeSingle();
  if(!rel.data)throw new Error("Release not found");
  let previous:any=null;
  if(rel.data.previous_release_id)previous=(await service!.from("dimpho_model_releases").select("*").eq("id",rel.data.previous_release_id).maybeSingle()).data;
  if(!previous)throw new Error("No previous release available for rollback");
  await service!.from("dimpho_model_routes").update({model_id:previous.model_id,updated_by:userId,updated_at:new Date().toISOString()}).eq("route_key",rel.data.route_key);
  await service!.from("dimpho_model_releases").update({status:"rolled_back",rolled_back_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",rel.data.id);
  await service!.from("dimpho_model_releases").update({status:"production",traffic_percent:100,updated_at:new Date().toISOString()}).eq("id",previous.id);
  await service!.from("dimpho_release_events").insert({release_id:rel.data.id,event_type:"rolled_back",actor_user_id:userId,payload:{restored_release_id:previous.id,reason:body.reason||null}});
  return{rolled_back:rel.data.id,restored:previous.id};
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!service||!anon)return json({error:"Runtime not configured"},500);
  const who=await authorized(req);
  if(!who.ok)return json({error:"Staff access required"},403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"health");
  try{
    if(action==="health"){
      const [routine,complex,gate]=await Promise.all([getRoute("routine"),getRoute("complex"),service.rpc("dimpho_latest_eval_gate",{p_suite_key:"production_gate"})]);
      return json({ok:true,release:8,routes:{routine,complex},latest_eval_gate:gate.data||{},fine_tune_submission_requires_explicit_cost_authorization:true});
    }
    if(action==="route"){
      const key=String(body.route_key||((body.complexity==="high"||body.risk==="red")?"complex":"routine"));
      const route=await getRoute(key);
      if(!route)return json({error:"Model route unavailable"},404);
      await recordRoute(route,body);
      return json({ok:true,route});
    }
    if(action==="freeze_dataset")return json({ok:true,dataset:await freezeDataset(who.userId,body)});
    if(action==="submit_finetune")return json({ok:true,job:await submitFineTune(who.userId,body)});
    if(action==="sync_finetune")return json({ok:true,jobs:await syncFineTune(body)});
    if(action==="promote_model")return json({ok:true,release:await promoteModel(who.userId,body)});
    if(action==="rollback_model")return json({ok:true,rollback:await rollbackModel(who.userId,body)});
    return json({error:"Unknown action"},400);
  }catch(e){return json({ok:false,error:e instanceof Error?e.message:String(e)},500);}
});
