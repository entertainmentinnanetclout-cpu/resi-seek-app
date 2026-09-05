import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const accountSid=env("TWILIO_ACCOUNT_SID");
const authToken=env("TWILIO_AUTH_TOKEN");
const voiceFrom=env("TWILIO_VOICE_FROM");
const webhookBase=env("TWILIO_VOICE_WEBHOOK_URL")||`${supabaseUrl}/functions/v1/adminos-voice-webhook`;
const e164=(value="")=>{let d=String(value).replace(/\D/g,""); if(d.startsWith("0")&&d.length===10)d=`27${d.slice(1)}`; if(!d.startsWith("27")&&d.length===9)d=`27${d}`; return d?`+${d}`:"";};
const basic=()=>`Basic ${btoa(`${accountSid}:${authToken}`)}`;
const aiRoles=new Set(["admin","system_operator","operations_lead","growth_lead"]);

async function authStaff(req:Request,service:any){
  const h=req.headers.get("Authorization")||""; if(!h||!anonKey)return {ok:false,userId:null,role:null};
  const auth=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:h}}}); const {data}=await auth.auth.getUser(); const user=data?.user;
  if(!user)return {ok:false,userId:null,role:null}; const rr=await service.rpc("get_user_staff_role",{_user_id:user.id});
  return {ok:Boolean(rr.data),userId:rr.data?user.id:null,role:rr.data||null};
}

async function voicePermission(service:any,contactId:string,purpose:string){
  const pref=(await service.from("adminos_communication_preferences").select("voice_allowed,marketing_allowed,do_not_contact").eq("contact_id",contactId).maybeSingle()).data;
  if(pref?.do_not_contact)return {allowed:false,reason:"do_not_contact",basis:null};
  if(pref?.voice_allowed===false)return {allowed:false,reason:"voice_disabled",basis:null};
  if(purpose==="marketing"){
    if(!pref?.marketing_allowed)return {allowed:false,reason:"marketing_disabled",basis:null};
    const consent=(await service.from("adminos_consents").select("id,source,granted_at").eq("contact_id",contactId).eq("channel","voice").eq("status","granted").in("purpose",["marketing","direct_marketing"]).order("granted_at",{ascending:false}).limit(1).maybeSingle()).data;
    if(!consent)return {allowed:false,reason:"voice_marketing_consent_missing",basis:null};
    return {allowed:true,reason:"allowed",basis:`consent:${consent.id}`};
  }
  return {allowed:true,reason:"allowed",basis:"service_relationship"};
}

function inQuietHours(){const hour=Number(new Intl.DateTimeFormat("en-ZA",{timeZone:"Africa/Johannesburg",hour:"2-digit",hour12:false}).format(new Date()));return hour>=20||hour<8;}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey||!anonKey)return json({error:"Supabase runtime is not configured"},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}}); const authz=await authStaff(req,service);
  if(!authz.ok)return json({error:"Staff access required"},403);
  const body=await req.json().catch(()=>({})); const action=String(body.action||"health");
  const settingsRow=await service.from("platform_settings").select("value").eq("key","adminos_voice_settings").maybeSingle(); const settings=settingsRow.data?.value||{};

  if(action==="health")return json({ok:true,software_ready:true,provider_configured:Boolean(accountSid&&authToken&&voiceFrom),enabled:Boolean(settings.enabled),ai_voice_enabled:Boolean(settings.ai_voice_enabled),marketing_calls_enabled:Boolean(settings.marketing_calls_enabled),record_calls:false,manual_calls_primary:true,release:4,phase:10});

  if(action==="test_provider"){
    if(!accountSid||!authToken)return json({error:"Twilio credentials are not configured",configured:false},409);
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,{headers:{Authorization:basic()}}); const d=await r.json().catch(()=>({}));
    await service.from("adminos_integration_connections").update(r.ok?{status:"connected",enabled:true,setup_step:3,last_tested_at:new Date().toISOString(),last_success_at:new Date().toISOString(),last_error:null}:{status:"error",enabled:false,last_tested_at:new Date().toISOString(),last_error_at:new Date().toISOString(),last_error:d?.message||`Twilio HTTP ${r.status}`}).eq("provider","twilio_voice");
    if(!r.ok)return json({error:d?.message||`Twilio HTTP ${r.status}`},400);
    return json({ok:true,account_sid:d.sid||accountSid,status:d.status||"active"});
  }

  if(action==="set_voice_enabled"){
    if(!["admin","system_operator"].includes(String(authz.role)))return json({error:"Admin or system operator access required"},403);
    const next={...settings,enabled:Boolean(body.enabled),ai_voice_enabled:Boolean(body.ai_voice_enabled),marketing_calls_enabled:Boolean(body.marketing_calls_enabled),record_calls:false,manual_calls_primary:true,updated_by:authz.userId};
    if(next.ai_voice_enabled&&(!accountSid||!authToken||!voiceFrom))return json({error:"Connect Twilio Voice before enabling AI voice"},409);
    await service.from("platform_settings").update({value:next,updated_at:new Date().toISOString(),updated_by:authz.userId}).eq("key","adminos_voice_settings");
    await service.from("adminos_agent_config").update({enabled:Boolean(next.ai_voice_enabled),updated_at:new Date().toISOString()}).eq("agent_key","voice_agent");
    await service.from("adminos_audit_events").insert({actor_type:"staff",actor_id:authz.userId,action:"voice.settings_changed",entity_type:"adminos_voice_settings",after_state:next,metadata:{release:4,phase:10}});
    return json({ok:true,settings:next});
  }

  if(action==="queue_call"){
    const contactId=String(body.contact_id||""); if(!contactId)return json({error:"contact_id is required"},400);
    const contact=(await service.from("adminos_contacts").select("id,phone,full_name").eq("id",contactId).maybeSingle()).data; if(!contact)return json({error:"Contact not found"},404); if(!e164(contact.phone))return json({error:"Contact has no callable phone number"},409);
    const purpose=String(body.purpose||"service"); const mode=body.mode==="ai_voice"?"ai_voice":"manual"; const permission=await voicePermission(service,contactId,purpose); if(!permission.allowed)return json({error:permission.reason},403);
    const insert=await service.from("adminos_call_queue").insert({contact_id:contactId,prospect_id:body.prospect_id||null,purpose,mode,priority:body.priority||"normal",status:body.scheduled_for?"scheduled":"queued",scheduled_for:body.scheduled_for||new Date().toISOString(),assigned_to:mode==="manual"?(body.assigned_to||authz.userId):null,recommended_reason:body.reason?String(body.reason).slice(0,1000):null,created_by:authz.userId,metadata:{release:4,phase:10,consent_basis:permission.basis}}).select("*").single();
    if(insert.error)return json({error:insert.error.message},409); return json({ok:true,queue:insert.data,external_call_started:false});
  }

  if(action==="make_ai_call"){
    if(!aiRoles.has(String(authz.role)))return json({error:"This role cannot launch AI voice calls"},403);
    if(!settings.enabled||!settings.ai_voice_enabled)return json({error:"AI Voice is on standby and currently OFF"},409);
    if(inQuietHours())return json({error:"Voice quiet hours are active (20:00–08:00 Africa/Johannesburg)"},409);
    if(!accountSid||!authToken||!voiceFrom)return json({error:"Twilio Voice is not configured"},409);
    const queueId=String(body.queue_id||""); if(!queueId)return json({error:"queue_id is required"},400);
    const q=(await service.from("adminos_call_queue").select("*,adminos_contacts(id,phone,full_name)").eq("id",queueId).maybeSingle()).data; if(!q)return json({error:"Call queue item not found"},404);
    if(q.mode!=="ai_voice")return json({error:"Queue item is not AI voice mode"},409);
    if(q.purpose==="marketing"&&!settings.marketing_calls_enabled)return json({error:"AI marketing calls are OFF"},409);
    const permission=await voicePermission(service,q.contact_id,q.purpose); if(!permission.allowed){await service.from("adminos_call_queue").update({status:"blocked",blocked_reason:permission.reason}).eq("id",queueId);return json({error:permission.reason},403);}
    const dayAgo=new Date(Date.now()-24*3600*1000).toISOString(); const daily=await service.from("adminos_calls").select("id",{count:"exact",head:true}).eq("mode","ai_voice").gte("created_at",dayAgo); if((daily.count||0)>=Number(settings.max_ai_calls_per_day||20))return json({error:"Daily AI voice limit reached"},429);
    const to=e164(q.adminos_contacts?.phone||""); if(!to)return json({error:"Contact phone is invalid"},409);
    const call=await service.from("adminos_calls").insert({queue_id:queueId,prospect_id:q.prospect_id,contact_id:q.contact_id,direction:"outbound",mode:"ai_voice",purpose:q.purpose,provider:"twilio",from_number:e164(voiceFrom),to_number:to,status:"queued",consent_basis:permission.basis,created_by:authz.userId,metadata:{release:4,phase:10,recording:false}}).select("*").single(); if(call.error)return json({error:call.error.message},400);
    const callId=call.data.id; const twimlUrl=`${webhookBase}?call_id=${encodeURIComponent(callId)}&phase=start`; const statusUrl=`${webhookBase}?call_id=${encodeURIComponent(callId)}&phase=status`;
    const form=new URLSearchParams({To:to,From:e164(voiceFrom),Url:twimlUrl,Method:"POST",StatusCallback:statusUrl,StatusCallbackMethod:"POST",Timeout:"20"}); for(const ev of ["initiated","ringing","answered","completed"])form.append("StatusCallbackEvent",ev);
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,{method:"POST",headers:{Authorization:basic(),"Content-Type":"application/x-www-form-urlencoded"},body:form}); const d=await r.json().catch(()=>({}));
    if(!r.ok){const err=d?.message||`Twilio HTTP ${r.status}`;await service.from("adminos_calls").update({status:"failed",outcome:err,ended_at:new Date().toISOString()}).eq("id",callId);await service.from("adminos_call_queue").update({status:"queued",attempt_count:q.attempt_count+1,last_attempt_at:new Date().toISOString()}).eq("id",queueId);return json({error:err},400);}
    await service.from("adminos_calls").update({twilio_call_sid:d.sid,status:d.status==="queued"?"queued":"initiated",started_at:new Date().toISOString()}).eq("id",callId); await service.from("adminos_call_queue").update({status:"calling",attempt_count:q.attempt_count+1,last_attempt_at:new Date().toISOString()}).eq("id",queueId);
    await service.from("adminos_call_events").insert({call_id:callId,event_type:"outbound.created",provider_status:d.status||"queued",payload:{twilio_call_sid:d.sid,queue_time:d.queue_time||null}});
    return json({ok:true,call_id:callId,twilio_call_sid:d.sid,status:d.status||"queued",recording:false});
  }

  if(action==="log_manual"){
    const queueId=String(body.queue_id||""); const outcome=String(body.outcome||""); const allowed=["answered","no_answer","interested","not_interested","call_later","resolved","busy","wrong_number"]; if(!queueId||!allowed.includes(outcome))return json({error:"Valid queue_id and outcome are required"},400);
    const q=(await service.from("adminos_call_queue").select("*").eq("id",queueId).maybeSingle()).data; if(!q)return json({error:"Call queue item not found"},404);
    const status=outcome==="no_answer"?"no_answer":outcome==="busy"?"busy":"completed"; const now=new Date().toISOString();
    const call=await service.from("adminos_calls").insert({queue_id:queueId,prospect_id:q.prospect_id,contact_id:q.contact_id,direction:"outbound",mode:"manual",purpose:q.purpose,provider:"manual",status,outcome,summary:body.notes?String(body.notes).slice(0,4000):null,started_at:now,ended_at:now,created_by:authz.userId,metadata:{release:4,phase:10}}).select("id").single(); if(call.error)return json({error:call.error.message},400);
    const retry=["no_answer","busy","call_later"].includes(outcome)&&q.attempt_count+1<q.max_attempts; const next=body.next_attempt_at||new Date(Date.now()+24*3600*1000).toISOString();
    await service.from("adminos_call_queue").update({status:retry?"scheduled":"completed",attempt_count:q.attempt_count+1,last_attempt_at:now,next_attempt_at:retry?next:null,scheduled_for:retry?next:q.scheduled_for}).eq("id",queueId);
    if(q.prospect_id){const patch:any={last_contacted_at:now,response_state:["answered","interested","resolved"].includes(outcome)?"engaged":"awaiting_reply",updated_at:now}; if(outcome==="not_interested"){patch.stage="not_interested";patch.automation_state="completed";} await service.from("adminos_prospects").update(patch).eq("id",q.prospect_id); await service.rpc("adminos_recalculate_prospect_score",{p_prospect_id:q.prospect_id});}
    await service.from("adminos_call_events").insert({call_id:call.data.id,event_type:"manual.outcome",provider_status:status,payload:{outcome,retry}}); return json({ok:true,call_id:call.data.id,retry_scheduled:retry,next_attempt_at:retry?next:null});
  }

  return json({error:"Unsupported action"},400);
});