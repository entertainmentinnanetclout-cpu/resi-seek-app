import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const authToken=env("TWILIO_AUTH_TOKEN");
const webhookBase=env("TWILIO_VOICE_WEBHOOK_URL")||`${supabaseUrl}/functions/v1/adminos-voice-webhook`;
const xmlEscape=(s:string)=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const twiml=(inner:string,status=200)=>new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`,{status,headers:{"Content-Type":"text/xml; charset=utf-8"}});

async function hmacSha1Base64(keyText:string,value:string){const enc=new TextEncoder();const key=await crypto.subtle.importKey("raw",enc.encode(keyText),{name:"HMAC",hash:"SHA-1"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,enc.encode(value));let binary="";for(const b of new Uint8Array(sig))binary+=String.fromCharCode(b);return btoa(binary);}
async function verifyTwilio(req:Request,params:URLSearchParams){if(!authToken)return false;const received=req.headers.get("X-Twilio-Signature")||"";let payload=req.url;const keys=Array.from(new Set(Array.from(params.keys()))).sort();for(const key of keys)for(const value of params.getAll(key))payload+=`${key}${value}`;const expected=await hmacSha1Base64(authToken,payload);if(received.length!==expected.length)return false;let diff=0;for(let i=0;i<received.length;i++)diff|=received.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}
const gather=(callId:string,prompt:string)=>`<Gather input="speech" action="${xmlEscape(`${webhookBase}?call_id=${encodeURIComponent(callId)}&phase=respond`)}" method="POST" speechTimeout="auto" timeout="5" actionOnEmptyResult="true"><Say>${xmlEscape(prompt)}</Say></Gather>`;

serve(async(req)=>{
  if(req.method!=="POST")return twiml("<Say>Method not allowed.</Say>",405);
  if(!supabaseUrl||!serviceKey||!authToken)return twiml("<Say>The automated call service is unavailable.</Say>",503);
  const raw=await req.text();const params=new URLSearchParams(raw);if(!(await verifyTwilio(req,params)))return twiml("<Say>Unauthorized request.</Say>",403);
  const url=new URL(req.url);const callId=url.searchParams.get("call_id")||"";const phase=url.searchParams.get("phase")||"start";if(!callId)return twiml("<Say>Call reference missing.</Say>",400);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
  const call=(await service.from("adminos_calls").select("*,adminos_contacts(full_name),adminos_call_queue(*)").eq("id",callId).maybeSingle()).data;if(!call)return twiml("<Say>This call could not be found.</Say>",404);
  const callSid=params.get("CallSid")||call.twilio_call_sid||null;

  if(phase==="status"){
    const rawStatus=params.get("CallStatus")||"";const map:Record<string,string>={queued:"queued",initiated:"initiated",ringing:"ringing","in-progress":"in_progress",completed:"completed",busy:"busy",failed:"failed","no-answer":"no_answer",canceled:"canceled"};const status=map[rawStatus]||call.status;
    const patch:any={status,twilio_call_sid:callSid,updated_at:new Date().toISOString()};if(status==="in_progress")patch.answered_at=new Date().toISOString();if(["completed","busy","failed","no_answer","canceled"].includes(status)){patch.ended_at=new Date().toISOString();const secs=Number(params.get("CallDuration")||0);if(secs>=0)patch.duration_seconds=secs;}
    await service.from("adminos_calls").update(patch).eq("id",callId);await service.from("adminos_call_events").insert({call_id:callId,event_type:`twilio.${rawStatus||status}`,provider_status:rawStatus||status,payload:Object.fromEntries(params.entries())});
    if(call.queue_id&&["completed","busy","failed","no_answer","canceled"].includes(status)){
      const q=(await service.from("adminos_call_queue").select("*").eq("id",call.queue_id).maybeSingle()).data;
      if(q&&q.mode!=="manual"){
        if(["busy","no_answer","failed"].includes(status)&&q.attempt_count<q.max_attempts){const next=new Date(Date.now()+24*3600*1000).toISOString();await service.from("adminos_call_queue").update({status:"scheduled",next_attempt_at:next,scheduled_for:next}).eq("id",q.id);}
        else await service.from("adminos_call_queue").update({status:"completed",next_attempt_at:null}).eq("id",q.id);
      }
    }
    if(["completed","busy","failed","no_answer","canceled"].includes(status)){
      const turns=(await service.from("adminos_call_turns").select("speaker,content,created_at").eq("call_id",callId).order("created_at",{ascending:true})).data||[];const transcript=turns.map((t:any)=>`${t.speaker.toUpperCase()}: ${t.content}`).join("\n").slice(0,20000);await service.from("adminos_calls").update({transcript,summary:transcript?`AI voice interaction captured ${turns.length} turn(s). Review transcript for details.`:call.summary}).eq("id",callId);
    }
    return twiml("");
  }

  if(phase==="start"){
    const first=String(call.adminos_contacts?.full_name||"there").trim().split(/\s+/)[0]||"there";const purpose=String(call.purpose||"service").replaceAll("_"," ");const prompt=`Hello ${first}. This is ResKonnect's automated assistant calling about your ${purpose}. This call is automated and is not being recorded. You can say human at any time if you want a person to follow up. How can I help?`;
    await service.from("adminos_call_turns").insert({call_id:callId,speaker:"agent",content:prompt});await service.from("adminos_calls").update({twilio_call_sid:callSid,status:"in_progress",answered_at:new Date().toISOString()}).eq("id",callId);
    return twiml(`${gather(callId,prompt)}<Say>We did not receive a response. A ResKonnect team member can follow up if needed. Goodbye.</Say>`);
  }

  const speech=String(params.get("SpeechResult")||"").trim().slice(0,3000);const confidence=params.get("Confidence")?Number(params.get("Confidence")):null;
  if(!speech){return twiml("<Say>We did not receive a response. Goodbye.</Say>");}
  await service.from("adminos_call_turns").insert({call_id:callId,speaker:"contact",content:speech,confidence:Number.isFinite(confidence)?confidence:null});
  const lower=speech.toLowerCase();

  if(/do not call|don't call|stop calling|no more calls/.test(lower)){
    await service.from("adminos_communication_preferences").upsert({contact_id:call.contact_id,voice_allowed:false,updated_at:new Date().toISOString()},{onConflict:"contact_id"});
    if(/stop contacting|do not contact|don't contact/.test(lower))await service.from("adminos_communication_preferences").upsert({contact_id:call.contact_id,voice_allowed:false,marketing_allowed:false,do_not_contact:true,updated_at:new Date().toISOString()},{onConflict:"contact_id"});
    const reply="Understood. ResKonnect will not call this number again through the automated call system. Goodbye.";await service.from("adminos_call_turns").insert({call_id:callId,speaker:"agent",content:reply});await service.from("adminos_calls").update({outcome:"voice_opt_out",summary:"Contact opted out of voice calls."}).eq("id",callId);return twiml(`<Say>${xmlEscape(reply)}</Say>`);
  }

  if(/\bhuman\b|\bperson\b|real agent|call me back|staff member/.test(lower)){
    if(call.queue_id)await service.from("adminos_call_queue").update({mode:"manual",status:"queued",scheduled_for:new Date().toISOString(),next_attempt_at:new Date().toISOString(),priority:"high",recommended_reason:"Contact requested human handoff during AI voice call",metadata:{...(call.adminos_call_queue?.metadata||{}),handoff_requested:true}}).eq("id",call.queue_id);
    const reply="Absolutely. I have marked this for a ResKonnect team member to follow up personally. Goodbye.";await service.from("adminos_call_turns").insert({call_id:callId,speaker:"agent",content:reply});await service.from("adminos_calls").update({outcome:"human_handoff",summary:"Contact requested a human follow-up."}).eq("id",callId);return twiml(`<Say>${xmlEscape(reply)}</Say>`);
  }

  const contactTurns=(await service.from("adminos_call_turns").select("id",{count:"exact",head:true}).eq("call_id",callId).eq("speaker","contact")).count||0;
  if(contactTurns>=4){if(call.queue_id)await service.from("adminos_call_queue").update({mode:"manual",status:"queued",scheduled_for:new Date().toISOString(),priority:"normal",recommended_reason:"AI voice turn limit reached; human follow-up recommended"}).eq("id",call.queue_id);const reply="Thank you. I have enough information for now. A ResKonnect team member can continue from here if needed. Goodbye.";await service.from("adminos_call_turns").insert({call_id:callId,speaker:"agent",content:reply});return twiml(`<Say>${xmlEscape(reply)}</Say>`);}

  let answer="I cannot confirm that safely on this automated call. I will flag it for a ResKonnect team member to follow up.";
  try{
    const r=await fetch(`${supabaseUrl}/functions/v1/adminos-agent`,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"Content-Type":"application/json"},body:JSON.stringify({action:"public_enquiry",message:speech,contact_id:call.contact_id,context:{channel:"voice",purpose:call.purpose,automated_outbound:true,do_not_make_financial_or_legal_commitments:true}})});const d=await r.json().catch(()=>({}));
    if(r.ok&&d.answer&&d.risk==="green"&&!d.escalate)answer=String(d.answer).slice(0,1000);else if(call.queue_id)await service.from("adminos_call_queue").update({mode:"manual",status:"queued",scheduled_for:new Date().toISOString(),priority:"high",recommended_reason:d.reason||d.error||"AI voice escalation"}).eq("id",call.queue_id);
  }catch(e){if(call.queue_id)await service.from("adminos_call_queue").update({mode:"manual",status:"queued",scheduled_for:new Date().toISOString(),priority:"high",recommended_reason:e instanceof Error?e.message:String(e)}).eq("id",call.queue_id);}
  await service.from("adminos_call_turns").insert({call_id:callId,speaker:"agent",content:answer});return twiml(`${gather(callId,answer)}<Say>Thank you for your time. Goodbye.</Say>`);
});