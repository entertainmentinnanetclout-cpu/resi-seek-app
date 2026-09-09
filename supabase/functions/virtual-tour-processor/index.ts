import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-tour-internal","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const env=(n:string)=>Deno.env.get(n)||"";
const url=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const sk=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const db=url&&sk?createClient(url,sk,{auth:{persistSession:false}}):null;
const clamp=(n:number)=>Math.max(0,Math.min(100,Number.isFinite(n)?n:0));

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!db||!sk)return json({error:"Runtime not configured"},500);
  if(req.headers.get("x-tour-internal")!==sk)return json({error:"Internal processor access required"},403);
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"health");
  if(action==="health")return json({ok:true,service:"virtual-tour-processor",release:"v2",phases:[4,5,6]});
  if(action!=="quality_check"&&action!=="mark_failed")return json({error:"Unknown action"},400);
  const sceneId=String(body.scene_id||"");
  if(!sceneId)return json({error:"scene_id required"},400);
  const scene=(await db.from("virtual_tour_scenes").select("id,tour_id,status").eq("id",sceneId).maybeSingle()).data;
  if(!scene)return json({error:"Scene not found"},404);
  if(action==="mark_failed"){
    const message=String(body.error||"Processing failed").slice(0,600);
    await db.from("virtual_tour_scenes").update({status:"failed",metadata:{processor_error:message}}).eq("id",sceneId);
    await db.from("virtual_tour_processing_jobs").insert({tour_id:scene.tour_id,scene_id:sceneId,job_type:"quality_check",status:"failed",progress:100,error_message:message,completed_at:new Date().toISOString(),input_payload:body.metadata||{}});
    return json({ok:true,scene_id:sceneId,status:"failed"});
  }
  const m=body.metrics||{};
  const metrics={sharpness:clamp(Number(m.sharpness||0)),lighting:clamp(Number(m.lighting||0)),coverage:clamp(Number(m.coverage||0)),overlap:clamp(Number(m.overlap||0)),stability:clamp(Number(m.stability||0)),exposure_consistency:clamp(Number(m.exposure_consistency||0))};
  const job=await db.from("virtual_tour_processing_jobs").insert({tour_id:scene.tour_id,scene_id:sceneId,job_type:"quality_check",status:"running",progress:45,started_at:new Date().toISOString(),input_payload:{metrics,privacy_issues:body.privacy_issues||[]}}).select("id").single();
  const result=await db.rpc("virtual_tour_scene_quality_upsert",{p_scene_id:sceneId,p_metrics:metrics,p_privacy_issues:Array.isArray(body.privacy_issues)?body.privacy_issues:[]});
  if(result.error){if(job.data?.id)await db.from("virtual_tour_processing_jobs").update({status:"failed",progress:100,error_message:result.error.message,completed_at:new Date().toISOString()}).eq("id",job.data.id);return json({error:result.error.message},500);}
  if(job.data?.id)await db.from("virtual_tour_processing_jobs").update({status:"completed",progress:100,output_payload:result.data||{},completed_at:new Date().toISOString()}).eq("id",job.data.id);
  return json({ok:true,quality:result.data});
});
