import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-rk-brain-internal","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const openAIKey=env("OPENAI_API_KEY");
const lovableKey=env("LOVABLE_API_KEY");
const PUBLIC_BASE="https://www.reskonnect.org";
const RELEASE=1;
const FALLBACK_MODEL="google/gemini-2.5-flash";
const SAFE_MEMORY=new Set(["campus","institution","budget_min","budget_max","room_preference","language_preference","communication_preference","funding_type","accommodation_preferences","transport_preference","course","year_of_study","preferred_residence","opportunity_preferences","study_level","move_in_period"]);
const SENSITIVE_PATTERN=/\b(password|passcode|otp|one[- ]?time pin|cvv|bank account|account number|identity number|id number|passport number|medical|diagnosis|health condition)\b/i;
const safe=(v:unknown,max=500)=>String(v??"").trim().slice(0,max);
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const canonicalize=(value:string)=>String(value||"").replace(/https:\/\/(?:www\.)?reskonnect\.org/gi,PUBLIC_BASE).replace(/https:\/\/[^\s]*\.vercel\.app[^\s]*/gi,PUBLIC_BASE);
const extractText=(data:any)=>{if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&typeof part?.text==="string")return part.text;return data?.choices?.[0]?.message?.content||"";};
const costFor=(model:string,input=0,output=0)=>{const rates:Record<string,[number,number]>={"gpt-5.6-luna":[.20,1.20],"gpt-5.6-terra":[2,12],"gpt-5.6-sol":[4,20]};const r=rates[model]||[0,0];return input/1e6*r[0]+output/1e6*r[1];};
const cleanIntent=(v:any)=>safe(v,100).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||null;

function parseModel(raw:string){
  const cleaned=raw.trim().replace(/^~~~json\s*/i,"").replace(/~~~$/i,"").trim();
  try{
    const p=JSON.parse(cleaned);
    const risk=["green","amber","red"].includes(p?.risk)?p.risk:"amber";
    return{
      answer:canonicalize(safe(p?.answer,6000)),
      confidence:clamp(Number(p?.confidence??.75),0,1),
      risk,
      escalate:Boolean(p?.escalate)||risk==="red",
      reason:safe(p?.reason,700),
      intent:cleanIntent(p?.intent),
      goal:safe(p?.goal,260)||null,
      entities:p?.entities&&typeof p.entities==="object"&&!Array.isArray(p.entities)?p.entities:{},
      memory_updates:Array.isArray(p?.memory_updates)?p.memory_updates.slice(0,10):[],
      tool_calls:Array.isArray(p?.tool_calls)?p.tool_calls.slice(0,3).map((x:any)=>({name:safe(x?.name,100),arguments:x?.arguments&&typeof x.arguments==="object"?x.arguments:{},confirmed:Boolean(x?.confirmed)})).filter((x:any)=>x.name):[],
      next_best_action:p?.next_best_action&&typeof p.next_best_action==="object"?p.next_best_action:null,
      outcome:safe(p?.outcome,80)||"answered"
    };
  }catch{
    return{answer:"I can’t verify a safe answer from ResKonnect data right now. I’ve marked this for review rather than guessing.",confidence:.35,risk:"amber",escalate:true,reason:"The model returned invalid structured output.",intent:null,goal:null,entities:{},memory_updates:[],tool_calls:[],next_best_action:{action:"human_review",reason:"invalid_model_output"},outcome:"escalated"};
  }
}

async function actor(req:Request,service:any){
  const authHeader=req.headers.get("Authorization")||"";
  const internal=(authHeader==="Bearer "+serviceKey)||(req.headers.get("x-rk-brain-internal")===serviceKey&&Boolean(serviceKey));
  if(internal)return{internal:true,user:null,role:"service",authHeader};
  if(!authHeader||!anonKey)return{internal:false,user:null,role:null,authHeader};
  const auth=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
  const data=(await auth.auth.getUser()).data;
  const user=data?.user||null;
  let role:string|null=null;
  if(user){try{role=(await service.rpc("get_user_staff_role",{_user_id:user.id})).data||null;}catch{}}
  return{internal:false,user,role,authHeader};
}

async function embed(text:string){
  if(!openAIKey||!text.trim())return null;
  try{
    const r=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{Authorization:"Bearer "+openAIKey,"Content-Type":"application/json"},body:JSON.stringify({model:"text-embedding-3-small",input:text.slice(0,8000)})});
    const d=await r.json().catch(()=>({}));const v=d?.data?.[0]?.embedding;
    return r.ok&&Array.isArray(v)?"["+v.join(",")+"]":null;
  }catch{return null;}
}

async function callModel(model:string,systemPrompt:string,payload:any,maxTokens=1200){
  let provider="",usedModel=model,raw="",usage:any={},lastError="";
  if(openAIKey){
    try{
      const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+openAIKey,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"system",content:[{type:"input_text",text:systemPrompt}]},{role:"user",content:[{type:"input_text",text:JSON.stringify(payload)}]}],max_output_tokens:maxTokens})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||("OpenAI HTTP "+r.status));raw=extractText(d);usage=d?.usage||{};provider="openai";
    }catch(e){lastError=e instanceof Error?e.message:String(e);}
  }
  if(!raw&&lovableKey){
    try{
      usedModel=FALLBACK_MODEL;
      const r=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+lovableKey,"Content-Type":"application/json"},body:JSON.stringify({model:usedModel,messages:[{role:"system",content:systemPrompt},{role:"user",content:JSON.stringify(payload)}],max_tokens:maxTokens})});
      const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||("AI gateway HTTP "+r.status));raw=extractText(d);usage=d?.usage||{};provider="lovable_gateway";
    }catch(e){lastError=e instanceof Error?e.message:String(e);}
  }
  if(!raw)throw new Error(lastError||"No AI provider is configured");
  return{raw,provider,model:usedModel,usage};
}

async function resolveIdentity(service:any,who:any,body:any){
  let userId:string|null=who.user?.id||null;let contactId:string|null=null;let contact:any=null;let profile:any=null;
  if(body?.context_user_id){const requested=safe(body.context_user_id,64);if(who.internal||who.role||requested===userId)userId=requested;}
  if(body?.contact_id&&(who.internal||who.role))contactId=safe(body.contact_id,64);
  if(contactId){contact=(await service.from("adminos_contacts").select("*").eq("id",contactId).maybeSingle()).data||null;if(!userId&&contact?.profile_user_id)userId=contact.profile_user_id;}
  if(userId){
    if(!contact){contact=(await service.from("adminos_contacts").select("*").eq("profile_user_id",userId).eq("status","active").order("updated_at",{ascending:false}).limit(1).maybeSingle()).data||null;contactId=contact?.id||contactId;}
    profile=(await service.from("profiles").select("id,full_name,email,phone,phone_number,student_number,campus,course,year_of_study,applicant_stage,updated_at").eq("id",userId).maybeSingle()).data||null;
  }
  return{userId,contactId,contact,profile};
}

async function loadMemory(service:any,userId:string|null,contactId:string|null){
  if(!userId&&!contactId)return[];
  let q=service.from("rk_brain_memory").select("memory_key,value,category,confidence,source_channel,last_confirmed_at,expires_at,updated_at").eq("status","active").order("updated_at",{ascending:false}).limit(40);
  q=userId?q.eq("user_id",userId):q.eq("contact_id",contactId).is("user_id",null);
  const data=(await q).data||[];
  return data.filter((x:any)=>!x.expires_at||new Date(x.expires_at).getTime()>Date.now());
}
async function loadState(service:any,channel:string,threadRef:string|null){if(!threadRef)return null;return (await service.from("rk_brain_conversation_state").select("*").eq("channel",channel).eq("thread_ref",threadRef).maybeSingle()).data||null;}
async function loadHistory(service:any,userId:string|null,contactId:string|null,channel:string,threadRef:string|null){
  let q=service.from("rk_brain_interactions").select("agent_key,channel,request_text,response_text,intent,goal,outcome,entities,next_best_action,created_at").order("created_at",{ascending:false}).limit(18);
  if(threadRef)q=q.eq("channel",channel).eq("thread_ref",threadRef);else if(userId)q=q.eq("user_id",userId);else if(contactId)q=q.eq("contact_id",contactId);else return[];
  return ((await q).data||[]).reverse();
}
async function loadHistoricalCustomerContext(service:any,userId:string|null,contactId:string|null){
  if(!userId&&!contactId)return{customer_events:[],whatsapp:[],enquiries:[],applications:[]};
  const out:any={customer_events:[],whatsapp:[],enquiries:[],applications:[]};
  try{
    let events=service.from("adminos_customer_events").select("event_category,event_type,title,summary,status,metadata,occurred_at").order("occurred_at",{ascending:false}).limit(24);
    events=userId?events.eq("user_id",userId):events.eq("contact_id",contactId);
    out.customer_events=(await events).data||[];
  }catch{}
  if(contactId){
    try{
      const threads=(await service.from("adminos_whatsapp_threads").select("id,status,intent,last_summary,conversation_state,last_inbound_at,last_outbound_at,last_message_at").eq("contact_id",contactId).order("last_message_at",{ascending:false}).limit(4)).data||[];
      const ids=threads.map((x:any)=>x.id);
      let messages:any[]=[];
      if(ids.length)messages=(await service.from("adminos_whatsapp_messages").select("thread_id,direction,body_text,status,created_at").in("thread_id",ids).order("created_at",{ascending:false}).limit(28)).data||[];
      out.whatsapp={threads,messages:messages.reverse()};
    }catch{}
  }
  try{
    let threads=service.from("adminos_enquiry_threads").select("id,subject,channel,status,priority,last_message_at,created_at").order("last_message_at",{ascending:false}).limit(4);
    threads=userId?threads.eq("profile_user_id",userId):threads.eq("contact_id",contactId);
    const rows=(await threads).data||[],ids=rows.map((x:any)=>x.id);
    let messages:any[]=[];
    if(ids.length)messages=(await service.from("adminos_enquiry_messages").select("thread_id,sender_type,direction,content,status,created_at").in("thread_id",ids).order("created_at",{ascending:false}).limit(28)).data||[];
    out.enquiries={threads:rows,messages:messages.reverse()};
  }catch{}
  if(userId){
    try{
      out.applications=(await service.from("applications").select("id,status,funding_type,move_in_date,moved_in,institution_type,academic_year,academic_cycle,academic_period,study_level,student_stage,residence_id,created_at,updated_at").eq("user_id",userId).order("updated_at",{ascending:false}).limit(10)).data||[];
    }catch{}
  }
  return out;
}

async function loadKnowledge(service:any,message:string){
  const results=await Promise.all([embed(message),service.from("adminos_knowledge_entries").select("knowledge_key,title,content,structured_data,confidence,requires_human_confirmation,valid_until").gte("confidence",.8).order("confidence",{ascending:false}).limit(18)]);
  let semantic:any[]=[];try{semantic=(await service.rpc("dimpho_search_knowledge",{p_query:message,p_embedding_text:results[0],p_limit:12,p_min_confidence:.55})).data||[];}catch{}
  const now=Date.now();const approved=(results[1].data||[]).filter((x:any)=>!x.valid_until||new Date(x.valid_until).getTime()>now).slice(0,12);
  return{semantic:semantic.slice(0,12),approved};
}
async function loadLiveFacts(service:any,message:string){
  const lower=message.toLowerCase();const facts:any={};
  if(/res|accommodation|room|rent|nsfas|campus|living|available|price|single|sharing/i.test(lower)){
    facts.available_residences=(await service.from("residences").select("id,name,slug,campus,address,city,price,private_price,nsfas_price,available_spots,accepts_nsfas,accepts_private,is_tut_accredited,distance_from_campus,room_type,room_types,verification_level").eq("is_visible",true).gt("available_spots",0).order("available_spots",{ascending:false}).limit(24)).data||[];
  }
  if(/wil|intern|opportunit|bursar|seta|job|graduate|learnership/i.test(lower)){
    const p=await Promise.all([service.from("public_opportunities").select("id,slug,title,opportunity_type,organisation,location,province,closing_date,application_url,last_verified_at").eq("is_published",true).order("closing_date",{ascending:true}).limit(18),service.from("bursaries").select("id,name,provider,amount,deadline,link,type").eq("is_active",true).order("deadline",{ascending:true}).limit(12)]);
    facts.public_opportunities=p[0].data||[];facts.bursaries=p[1].data||[];
  }
  return facts;
}
async function loadTools(service:any,allowlist:string[]){if(!allowlist.length)return[];return (await service.from("dimpho_tools").select("tool_key,name,description,category,risk_level,requires_auth,requires_confirmation,user_scoped,input_schema").eq("enabled",true).in("tool_key",allowlist).order("tool_key")).data||[];}

async function invokeTool(toolCall:any,identity:any,channel:string,threadRef:string|null,runId:string|null,message:string){
  const confirmed=Boolean(toolCall.confirmed)||(toolCall.name==="request_human_support"&&/\b(human|person|agent|someone|staff)\b/i.test(message));
  const r=await fetch(supabaseUrl+"/functions/v1/dimpho-tool-engine",{method:"POST",headers:{Authorization:"Bearer "+serviceKey,apikey:serviceKey,"x-rk-brain-internal":serviceKey,"Content-Type":"application/json"},body:JSON.stringify({tool:toolCall.name,arguments:toolCall.arguments||{},confirmed,caller_user_id:identity.userId,context_user_id:identity.userId,contact_id:identity.contactId,thread_ref:threadRef,channel,agent_run_id:runId})});
  const d=await r.json().catch(()=>({}));
  return{tool:toolCall.name,ok:r.ok&&d?.ok!==false,status:r.status,invocation_id:d?.invocation_id||null,result:d?.result||null,requires_confirmation:Boolean(d?.requires_confirmation),error:d?.error||null};
}

async function saveMemory(service:any,updates:any[],identity:any,agentKey:string,channel:string,threadRef:string|null){
  if(!identity.userId&&!identity.contactId)return 0;let written=0;
  for(const item of updates.slice(0,10)){
    const key=safe(item?.key,80),value=item?.value,serial=JSON.stringify(value??null);
    if(!SAFE_MEMORY.has(key)||item?.explicit!==true||value===undefined||value===null||SENSITIVE_PATTERN.test(key+" "+serial))continue;
    let q=service.from("rk_brain_memory").select("id").eq("memory_key",key).eq("status","active");q=identity.userId?q.eq("user_id",identity.userId):q.eq("contact_id",identity.contactId).is("user_id",null);
    const existing=(await q.limit(1).maybeSingle()).data;
    const patch={value,category:safe(item?.category,40)||"preference",sensitivity:"low",source:"conversation",source_channel:channel,source_ref:threadRef,source_agent_key:agentKey,confidence:clamp(Number(item?.confidence??.9),0,1),consent_basis:"service_context",status:"active",last_confirmed_at:new Date().toISOString(),expires_at:new Date(Date.now()+365*24*3600_000).toISOString(),metadata:{release:RELEASE,explicit:true},updated_at:new Date().toISOString()};
    const res=existing?await service.from("rk_brain_memory").update(patch).eq("id",existing.id):await service.from("rk_brain_memory").insert({...patch,user_id:identity.userId,contact_id:identity.userId?identity.contactId:null});if(!res.error)written++;
  }
  return written;
}
async function persistState(service:any,result:any,identity:any,agentKey:string,channel:string,threadRef:string|null){
  if(!threadRef)return;const existing=await loadState(service,channel,threadRef);
  await service.from("rk_brain_conversation_state").upsert({channel,thread_ref:threadRef,user_id:identity.userId,contact_id:identity.contactId,last_agent_key:agentKey,current_intent:result.intent||existing?.current_intent||null,current_goal:result.goal||existing?.current_goal||null,entities:{...(existing?.entities||{}),...(result.entities||{})},state:{...(existing?.state||{}),release:RELEASE,last_outcome:result.outcome},next_best_action:result.next_best_action||existing?.next_best_action||null,turn_count:Number(existing?.turn_count||0)+1,last_user_message_at:new Date().toISOString(),last_agent_message_at:new Date().toISOString(),expires_at:new Date(Date.now()+90*24*3600_000).toISOString(),metadata:{release:RELEASE,shared_brain:true},updated_at:new Date().toISOString()},{onConflict:"channel,thread_ref"});
}
async function observeIntent(service:any,intent:string|null,result:any){
  if(!intent)return;const existing=(await service.from("rk_brain_intent_catalog").select("*").eq("intent_key",intent).maybeSingle()).data;const now=new Date().toISOString();
  if(existing)await service.from("rk_brain_intent_catalog").update({observed_count:Number(existing.observed_count||0)+1,resolution_count:Number(existing.resolution_count||0)+(["resolved","action_executed"].includes(result.outcome)?1:0),escalation_count:Number(existing.escalation_count||0)+(result.escalate?1:0),last_seen_at:now,updated_at:now}).eq("intent_key",intent);
  else await service.from("rk_brain_intent_catalog").insert({intent_key:intent,label:intent.split("_").map((x:string)=>x?x[0].toUpperCase()+x.slice(1):x).join(" "),observed_count:1,resolution_count:["resolved","action_executed"].includes(result.outcome)?1:0,escalation_count:result.escalate?1:0,last_seen_at:now,metadata:{created_by:"reskonnect-brain"}});
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey||!anonKey)return json({error:"Supabase runtime is not configured"},500);
  const started=Date.now();const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});const body=await req.json().catch(()=>({}));const action=safe(body?.action||"chat",80);const who=await actor(req,service);const requestedAgent=safe(body?.agent_key||"luna",80);
  const loaded=await Promise.all([service.from("rk_brain_config").select("*").eq("config_key","core").maybeSingle(),service.from("rk_brain_agents").select("*").eq("agent_key",requestedAgent).maybeSingle()]);const core=loaded[0].data,agent=loaded[1].data;
  if(action==="health"){
    const counts=await Promise.all([service.from("rk_brain_memory").select("id",{count:"exact",head:true}).eq("status","active"),service.from("rk_brain_interactions").select("id",{count:"exact",head:true}).gte("created_at",new Date(Date.now()-24*3600_000).toISOString()),service.from("rk_brain_intent_catalog").select("intent_key",{count:"exact",head:true}).eq("status","active"),service.from("dimpho_knowledge_documents").select("id",{count:"exact",head:true}).eq("status","published")]);
    return json({ok:Boolean(core?.enabled&&agent?.enabled&&(openAIKey||lovableKey)),identity:"reskonnect-brain",release:RELEASE,agent:agent?.agent_key||null,provider_openai:Boolean(openAIKey),provider_fallback:Boolean(lovableKey),memory_count:counts[0].count||0,interactions_24h:counts[1].count||0,intents:counts[2].count||0,knowledge_documents:counts[3].count||0});
  }
  if(!core?.enabled)return json({error:"ResKonnect Brain is disabled"},503);
  if(!agent?.enabled)return json({error:"Requested agent is disabled"},503);
  if(!who.internal&&!who.user&&!agent.allow_public)return json({error:"Authentication required"},401);
  if(agent.agent_key==="adminos_copilot"&&!who.internal&&!who.role)return json({error:"Staff access required"},403);
  const message=safe(body?.message||body?.content,12000);if(!message)return json({error:"Message is required"},400);
  const channel=safe(body?.channel||body?.context?.channel||agent.channel||"unknown",80);const threadRef=safe(body?.thread_ref||body?.context?.thread_ref||body?.context?.thread_id,140)||null;const identity=await resolveIdentity(service,who,body);
  const run=await service.from("adminos_agent_runs").insert({agent_key:"rk_brain:"+agent.agent_key,trigger_type:action,status:"running",input:{channel,thread_ref:threadRef,authenticated:Boolean(who.user),contact_id:identity.contactId,shared_brain_release:RELEASE},created_by:who.user?.id||null}).select("id").single();const runId=run.data?.id||null;
  try{
    const loadedContext=await Promise.all([loadMemory(service,identity.userId,identity.contactId),loadState(service,channel,threadRef),loadHistory(service,identity.userId,identity.contactId,channel,threadRef),loadHistoricalCustomerContext(service,identity.userId,identity.contactId),loadKnowledge(service,message),loadLiveFacts(service,message),loadTools(service,agent.tool_allowlist||[])]);
    const memory=loadedContext[0],state=loadedContext[1],history=loadedContext[2],historicalCustomerContext=loadedContext[3],knowledge=loadedContext[4],liveFacts=loadedContext[5],tools=loadedContext[6];const externalHistory=Array.isArray(body?.context?.conversation_history)?body.context.conversation_history.slice(-12):[];
    const systemPrompt=core.master_instructions+"\n\nAGENT PROFILE\nName: "+agent.persona_name+"\nRole: "+(agent.role_title||agent.display_name)+"\nChannel: "+channel+"\nInstructions: "+agent.system_instructions+"\n\nOUTPUT CONTRACT\nReturn JSON only with keys answer, confidence, risk, escalate, reason, intent, goal, entities, memory_updates, tool_calls, next_best_action and outcome. risk must be green|amber|red. outcome must be answered|resolved|action_executed|awaiting_confirmation|escalated. memory_updates items must contain key,value,explicit,confidence. Only write a memory update when the customer explicitly stated the fact in the current message. Never place sensitive information in memory_updates. Use only listed tools.";
    const requestContext={message,channel,agent_key:agent.agent_key,customer:{contact:identity.contact,profile:identity.profile},shared_memory:memory,shared_conversation_state:state,cross_channel_history:history,historical_customer_context:historicalCustomerContext,channel_history:externalHistory,verified_knowledge:knowledge,verified_live_facts:liveFacts,available_tools:tools,caller_context:body?.context||{}};
    const first=await callModel(agent.default_model||"gpt-5.6-luna",systemPrompt,requestContext,1300);let result=parseModel(first.raw);const allowed=new Set((agent.tool_allowlist||[]).map((x:string)=>String(x)));const requested=result.tool_calls.filter((x:any)=>allowed.has(x.name));const toolResults:any[]=[];
    for(const call of requested)toolResults.push(await invokeTool(call,identity,channel,threadRef,runId,message));
    let provider=first.provider,model=first.model,usage=first.usage;
    if(toolResults.length){
      const second=await callModel(agent.default_model||"gpt-5.6-luna",systemPrompt+"\n\nTOOL-RESULT RULE\nTool execution has occurred. Base operational claims on supplied tool results. If confirmation is required, do not claim completion. Do not request the same tool again.",{...requestContext,initial_reasoning:result,tool_results:toolResults},1200);
      result=parseModel(second.raw);result.tool_calls=[];provider=second.provider;model=second.model;usage={input_tokens:Number(first.usage?.input_tokens||first.usage?.prompt_tokens||0)+Number(second.usage?.input_tokens||second.usage?.prompt_tokens||0),output_tokens:Number(first.usage?.output_tokens||first.usage?.completion_tokens||0)+Number(second.usage?.output_tokens||second.usage?.completion_tokens||0)};
      if(toolResults.some((x:any)=>x.requires_confirmation)){result.outcome="awaiting_confirmation";result.risk="amber";}else if(toolResults.some((x:any)=>x.ok)&&result.outcome==="answered")result.outcome="action_executed";
    }
    const inputTokens=Number(usage?.input_tokens||usage?.prompt_tokens||0),outputTokens=Number(usage?.output_tokens||usage?.completion_tokens||0);const memoryWritten=await saveMemory(service,result.memory_updates,identity,agent.agent_key,channel,threadRef);await persistState(service,result,identity,agent.agent_key,channel,threadRef);
    const interaction=await service.from("rk_brain_interactions").insert({agent_key:agent.agent_key,channel,thread_ref:threadRef,user_id:identity.userId,contact_id:identity.contactId,source_message_id:body?.source_message_id||null,request_text:message,response_text:result.answer,intent:result.intent,goal:result.goal,entities:result.entities||{},next_best_action:result.next_best_action,outcome:result.escalate?"escalated":result.outcome,confidence:result.confidence,risk:result.risk,escalated:result.escalate,tool_calls:requested,tool_results:toolResults,provider,model,run_id:runId,input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost_usd:costFor(model,inputTokens,outputTokens),latency_ms:Date.now()-started,metadata:{release:RELEASE,shared_brain:true,memory_written:memoryWritten,knowledge_semantic_count:knowledge.semantic.length,knowledge_approved_count:knowledge.approved.length}}).select("id").single();const interactionId=interaction.data?.id||null;await observeIntent(service,result.intent,result);
    if((identity.contactId||identity.userId)&&interactionId)await service.from("adminos_customer_events").insert({contact_id:identity.contactId,user_id:identity.userId,event_category:"ai_service",event_type:"brain_interaction",source_table:"rk_brain_interactions",source_id:interactionId,title:agent.persona_name+" customer-service interaction",summary:safe((result.intent||"general")+" · "+result.outcome,300),status:result.escalate?"escalated":"completed",metadata:{agent_key:agent.agent_key,channel,confidence:result.confidence,risk:result.risk,next_best_action:result.next_best_action},idempotency_key:"rk-brain:"+interactionId}).then(()=>null).catch(()=>null);
    if(runId)await service.from("adminos_agent_runs").update({status:"completed",output:{brain_release:RELEASE,agent_key:agent.agent_key,interaction_id:interactionId,intent:result.intent,outcome:result.outcome,risk:result.risk,confidence:result.confidence,escalate:result.escalate,memory_written:memoryWritten,tool_count:toolResults.length},completed_at:new Date().toISOString()}).eq("id",runId);
    if(runId)await service.from("adminos_agent_usage").insert({run_id:runId,agent_key:"rk_brain:"+agent.agent_key,provider,model,input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost_usd:costFor(model,inputTokens,outputTokens),latency_ms:Date.now()-started}).then(()=>null).catch(()=>null);
    return json({...result,agent_key:agent.agent_key,identity:agent.persona_name,brain_release:RELEASE,interaction_id:interactionId,run_id:runId,provider,model,tool_results:toolResults,memory_written:memoryWritten});
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);if(runId)await service.from("adminos_agent_runs").update({status:"failed",output:{error:detail,brain_release:RELEASE},completed_at:new Date().toISOString()}).eq("id",runId);await service.from("adminos_agent_errors").insert({run_id:runId,error_code:"RK_BRAIN_RUNTIME",error_message:detail,retryable:true,context:{agent_key:agent.agent_key,channel,release:RELEASE}}).then(()=>null).catch(()=>null);return json({error:"ResKonnect Brain is temporarily unavailable",detail,answer:"I can’t verify a safe answer right now. I’ve marked this for review rather than guessing.",confidence:.3,risk:"amber",escalate:true,agent_key:agent.agent_key,brain_release:RELEASE},503);
  }
});
