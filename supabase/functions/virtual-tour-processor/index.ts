import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-tour-internal","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(name:string)=>Deno.env.get(name)||"";
const url=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const db=url&&serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const clamp=(n:number)=>Math.max(0,Math.min(100,Number.isFinite(n)?n:0));
const message=(error:any,fallback="Processor error")=>String(error?.message||error||fallback).slice(0,700);

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({ok:false,error:"Method not allowed",code:"method_not_allowed"},405);
  if(!db||!serviceKey)return json({ok:false,error:"360 processor runtime is not configured",code:"runtime_not_configured"},500);
  if(req.headers.get("x-tour-internal")!==serviceKey)return json({ok:false,error:"Internal processor access required",code:"processor_access_denied"},403);

  const body=await req.json().catch(()=>null);
  if(!body||typeof body!=="object")return json({ok:false,error:"Valid JSON body required",code:"invalid_json"},400);
  const action=String(body.action||"health");
  if(action==="health")return json({ok:true,service:"virtual-tour-processor",release:"v3-standalone",supports:["residence","standalone"],actions:["quality_check","mark_failed"]});
  if(action!=="quality_check"&&action!=="mark_failed")return json({ok:false,error:"Unknown action",code:"unknown_action"},400);
  const sceneId=String(body.scene_id||"").trim();
  if(!/^[0-9a-f-]{36}$/i.test(sceneId))return json({ok:false,error:"Valid scene_id required",code:"invalid_scene_id"},400);

  const sceneResult=await db.from("virtual_tour_scenes").select("id,tour_id,status,metadata").eq("id",sceneId).maybeSingle();
  if(sceneResult.error)return json({ok:false,error:message(sceneResult.error),code:"scene_lookup_failed",stage:"scene_lookup"},500);
  const scene=sceneResult.data;
  if(!scene)return json({ok:false,error:"Scene not found",code:"scene_not_found"},404);
  const tourResult=await db.from("virtual_tours").select("id,residence_id,workspace_type,created_by,status").eq("id",scene.tour_id).maybeSingle();
  if(tourResult.error)return json({ok:false,error:message(tourResult.error),code:"tour_lookup_failed",stage:"tour_lookup"},500);
  if(!tourResult.data)return json({ok:false,error:"Scene has no valid parent 360 project",code:"tour_not_found"},409);

  if(action==="mark_failed"){
    const errorMessage=String(body.error||"Processing failed").slice(0,600);
    const sceneUpdate=await db.from("virtual_tour_scenes").update({status:"failed",metadata:{...(scene.metadata||{}),processor_error:errorMessage,processor_release:"v3-standalone",processor_failed_at:new Date().toISOString()}}).eq("id",sceneId);
    if(sceneUpdate.error)return json({ok:false,error:message(sceneUpdate.error),code:"scene_failure_update_failed",stage:"mark_failed"},500);
    const jobInsert=await db.from("virtual_tour_processing_jobs").insert({tour_id:scene.tour_id,scene_id:sceneId,job_type:"quality_check",status:"failed",progress:100,error_message:errorMessage,completed_at:new Date().toISOString(),input_payload:body.metadata||{},output_payload:{workspace_type:tourResult.data.workspace_type||"residence",processor_release:"v3-standalone"}});
    if(jobInsert.error)return json({ok:false,error:message(jobInsert.error),code:"failure_job_insert_failed",stage:"mark_failed_job"},500);
    return json({ok:true,scene_id:sceneId,tour_id:scene.tour_id,workspace_type:tourResult.data.workspace_type||"residence",status:"failed"});
  }

  const m=body.metrics||{};
  const metrics={sharpness:clamp(Number(m.sharpness||0)),lighting:clamp(Number(m.lighting||0)),coverage:clamp(Number(m.coverage||0)),overlap:clamp(Number(m.overlap||0)),stability:clamp(Number(m.stability||0)),exposure_consistency:clamp(Number(m.exposure_consistency||0))};
  const privacyIssues=Array.isArray(body.privacy_issues)?body.privacy_issues.slice(0,100):[];
  const job=await db.from("virtual_tour_processing_jobs").insert({tour_id:scene.tour_id,scene_id:sceneId,job_type:"quality_check",status:"running",progress:45,started_at:new Date().toISOString(),input_payload:{metrics,privacy_issues:privacyIssues,workspace_type:tourResult.data.workspace_type||"residence",processor_release:"v3-standalone"}}).select("id").single();
  if(job.error)return json({ok:false,error:message(job.error),code:"quality_job_insert_failed",stage:"job_create"},500);

  const result=await db.rpc("virtual_tour_scene_quality_upsert",{p_scene_id:sceneId,p_metrics:metrics,p_privacy_issues:privacyIssues});
  if(result.error){
    const failed=await db.from("virtual_tour_processing_jobs").update({status:"failed",progress:100,error_message:message(result.error),completed_at:new Date().toISOString(),output_payload:{processor_release:"v3-standalone",rpc_code:result.error.code||null}}).eq("id",job.data.id);
    if(failed.error)console.error("[virtual-tour-processor] failed to persist RPC failure",failed.error);
    return json({ok:false,error:message(result.error),code:"quality_rpc_failed",stage:"quality_rpc",job_id:job.data.id},422);
  }

  const completed=await db.from("virtual_tour_processing_jobs").update({status:"completed",progress:100,output_payload:{...(result.data||{}),processor_release:"v3-standalone",workspace_type:tourResult.data.workspace_type||"residence"},completed_at:new Date().toISOString()}).eq("id",job.data.id);
  if(completed.error)return json({ok:false,error:message(completed.error),code:"job_completion_failed",stage:"job_complete",quality:result.data},500);
  return json({ok:true,scene_id:sceneId,tour_id:scene.tour_id,workspace_type:tourResult.data.workspace_type||"residence",job_id:job.data.id,quality:result.data});
});
