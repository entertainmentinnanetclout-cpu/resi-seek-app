import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(name:string)=>Deno.env.get(name)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const routineModel="gpt-5.6-luna",complexModel="gpt-5.6-terra",PUBLIC_BASE="https://www.reskonnect.org",RELEASE=8;
const SAFE_MEMORY=new Set(["campus","institution","budget_min","budget_max","room_preference","language_preference","communication_preference","funding_type","accommodation_preferences","transport_preference"]);
const SAFE_ENTITY=new Set(["campus","institution","budget","budget_min","budget_max","room_type","room_preference","funding_type","residence_id","residence_slug","application_id","opportunity_type","language"]);
const extractText=(data:any)=>{if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&typeof part?.text==="string")return part.text;return data?.choices?.[0]?.message?.content||"";};
const sanitizeResKonnectLinks=(value:string)=>String(value||"").replace(/https:\/\/reskonnect\.org/gi,PUBLIC_BASE).replace(/https:\/\/www\.reskonnect\.org/gi,PUBLIC_BASE).replace(/https:\/\/www\.reskonnect\.org(?:\/[^\s<>]*)?/gi,(raw)=>{let cleaned=raw.replace(/[.,;:!?]+$/g,"");while(/[)\]}]$/.test(cleaned))cleaned=cleaned.slice(0,-1);try{const url=new URL(cleaned);if(url.origin!==PUBLIC_BASE)return PUBLIC_BASE;const bare=url.pathname.replace(/\/+$/,"")||"/";if(bare==="/find-my-res"||bare==="/findmyres")url.pathname="/find";url.hostname="www.reskonnect.org";url.protocol="https:";return url.toString().replace(/\/$/,url.pathname==="/"?"/":"");}catch{return PUBLIC_BASE;}});
const safeShort=(v:any,max=160)=>String(v??"").trim().slice(0,max);
const cleanObject=(v:any,keys:Set<string>)=>{const out:Record<string,unknown>={};if(v&&typeof v==="object"&&!Array.isArray(v))for(const [k,val] of Object.entries(v))if(keys.has(k))out[k]=val;return out;};
const parseAgentJson=(raw:string)=>{const cleaned=raw.trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();try{const p=JSON.parse(cleaned);return{answer:sanitizeResKonnectLinks(String(p.answer||"")),confidence:Math.max(0,Math.min(1,Number(p.confidence??.75))),risk:["green","amber","red"].includes(p.risk)?p.risk:"amber",escalate:Boolean(p.escalate),reason:safeShort(p.reason,600),intent:safeShort(p.intent,100)||null,goal:safeShort(p.goal,240)||null,tool_calls:Array.isArray(p.tool_calls)?p.tool_calls.slice(0,3).map((x:any)=>({name:safeShort(x?.name,100),arguments:x?.arguments&&typeof x.arguments==="object"?x.arguments:{},confirmed:Boolean(x?.confirmed)})).filter((x:any)=>x.name):[],memory_updates:Array.isArray(p.memory_updates)?p.memory_updates.slice(0,8):[],conversation_state:p.conversation_state&&typeof p.conversation_state==="object"?p.conversation_state:{}};}catch{return{answer:sanitizeResKonnectLinks(raw.trim()),confidence:.72,risk:"amber",escalate:true,reason:"Model output was not structured.",intent:null,goal:null,tool_calls:[],memory_updates:[],conversation_state:{}};}};
const costFor=(model:string,input=0,output=0)=>{const rates:Record<string,[number,number]>={"gpt-5.6-luna":[.20,1.20],"gpt-5.6-terra":[2,12],"gpt-5.6-sol":[4,20]};const[ri,ro]=rates[model]||[0,0];return input/1e6*ri+output/1e6*ro;};

async function probeOpenAIKey(key:string){if(!key)return{ok:false,error:"OPENAI_API_KEY is not configured"};const r=await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(routineModel)}`,{headers:{Authorization:`Bearer ${key}`}});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,model:d?.id||routineModel}:{ok:false,error:d?.error?.message||`OpenAI HTTP ${r.status}`};}
async function runOpenAITest(key:string){if(!key)return{ok:false,error:"OPENAI_API_KEY is not configured"};const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:routineModel,input:"Reply with exactly: OK",reasoning:{effort:"none"},max_output_tokens:16})});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,model:d?.model||routineModel,response_id:d?.id||null,output_text:extractText(d)}:{ok:false,error:d?.error?.message||`OpenAI HTTP ${r.status}`};}
async function setOpenAIConnection(service:any,result:any,tested=false){const now=new Date().toISOString();const patch=result.ok?{status:"connected",enabled:true,setup_step:3,external_account_label:`OpenAI API · ${result.model||routineModel}`,last_tested_at:tested?now:undefined,last_success_at:now,last_error:null,last_error_at:null}:{status:"needs_action",enabled:false,setup_step:2,last_tested_at:tested?now:undefined,last_error:result.error||"OpenAI verification failed",last_error_at:now};await service.from("adminos_integration_connections").update(Object.fromEntries(Object.entries(patch).filter(([,v])=>v!==undefined))).eq("provider","openai");}
async function queryEmbedding(key:string,message:string,model:string){if(!key||!message.trim())return null;try{const r=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:message.slice(0,8000)})});const d=await r.json().catch(()=>({}));if(!r.ok)return null;const v=d?.data?.[0]?.embedding;return Array.isArray(v)?`[${v.join(",")}]`:null;}catch{return null;}}

async function loadIntelligence(service:any,message:string,openaiKey:string){
  const [{data:persona},{data:settings},{data:workflows},{data:examples},{data:tools}]=await Promise.all([
    service.from("dimpho_personas").select("id,name,role_title,mission,active_version_id,dimpho_persona_versions!dimpho_personas_active_version_fk(version,compiled_prompt,system_prompt_template,sliders,channel_overrides)").eq("persona_key","dimpho").maybeSingle(),
    service.from("dimpho_intelligence_settings").select("embedding_model,reasoning_model,learning_enabled,release_state").eq("id",1).maybeSingle(),
    service.from("dimpho_app_workflows").select("id,workflow_key,name,description,entry_route,success_state,dimpho_app_workflow_steps(step_order,step_key,title,instruction,route_path,requirements,backend_checks,failure_recovery)").eq("status","active").order("name").limit(12),
    service.from("dimpho_training_examples").select("category,channel,user_input,ideal_output,tags,quality_score").eq("active",true).order("quality_score",{ascending:false}).limit(8),
    service.from("dimpho_tools").select("tool_key,name,description,category,risk_level,requires_auth,requires_confirmation,user_scoped,input_schema").eq("enabled",true).order("tool_key")
  ]);
  const embedding=await queryEmbedding(openaiKey,message,settings?.embedding_model||"text-embedding-3-small");
  let knowledge:any[]=[];
  try{knowledge=(await service.rpc("dimpho_search_knowledge",{p_query:message,p_embedding_text:embedding,p_limit:10,p_min_confidence:.55})).data||[];}catch{/* best effort */}
  const av=Array.isArray(persona?.dimpho_persona_versions)?persona.dimpho_persona_versions[0]:persona?.dimpho_persona_versions;
  return{persona:{name:persona?.name||"Dimpho",role_title:persona?.role_title||"ResKonnect AI Concierge",version:av?.version||null,compiled_prompt:av?.compiled_prompt||av?.system_prompt_template||null,sliders:av?.sliders||null,channel_overrides:av?.channel_overrides||null},settings:settings||{},knowledge,workflows:workflows||[],training_examples:examples||[],tools:tools||[],embedding_used:Boolean(embedding)};
}

async function modelRoute(service:any,key:string){try{const r=await service.rpc("dimpho_model_router_snapshot",{p_route_key:key});if(r.data&&Object.keys(r.data).length)return r.data;}catch{/* fallback */}return{route_key:key,model_key:key==="complex"?"legacy_complex":"legacy_routine",provider:"openai",model_name:key==="complex"?complexModel:routineModel,fallback_provider:"lovable_gateway",fallback_model_name:"google/gemini-2.5-flash",config:{}};}

async function callAI(openaiKey:string,lovableKey:string,route:any,systemPrompt:string,userPrompt:string,maxTokens:number){
  let raw="",usage:any={},provider="",usedModel=route?.model_name||routineModel,lastError="";
  if(openaiKey&&(!route?.provider||route.provider==="openai")){
    try{const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:usedModel,input:[{role:"system",content:[{type:"input_text",text:systemPrompt}]},{role:"user",content:[{type:"input_text",text:userPrompt}]}],max_output_tokens:maxTokens})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`OpenAI HTTP ${r.status}`);raw=extractText(d);usage=d?.usage||{};provider="openai";}catch(e){lastError=e instanceof Error?e.message:String(e);}
  }
  if(!raw&&lovableKey){try{usedModel=route?.fallback_model_name||"google/gemini-2.5-flash";const r=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${lovableKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:usedModel,messages:[{role:"system",content:systemPrompt},{role:"user",content:userPrompt}],max_tokens:maxTokens})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`AI gateway HTTP ${r.status}`);raw=extractText(d);usage=d?.usage||{};provider="lovable_gateway";}catch(e){lastError=e instanceof Error?e.message:String(e);}}
  return{raw,usage,provider,usedModel,lastError};
}

async function invokeTool(tool:any,context:any,runId:string,message:string){
  const confirmed=Boolean(tool.confirmed)||(tool.name==="request_human_support"&&/(human|person|agent|someone|staff)/i.test(message));
  const r=await fetch(`${supabaseUrl}/functions/v1/dimpho-tool-engine`,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"x-dimpho-internal":serviceKey,"Content-Type":"application/json"},body:JSON.stringify({tool:tool.name,arguments:tool.arguments||{},confirmed,caller_user_id:context.actorUserId,context_user_id:context.userId,contact_id:context.contactId,thread_ref:context.threadRef,channel:context.channel,agent_run_id:runId})});
  const data=await r.json().catch(()=>({}));
  return{tool:tool.name,ok:r.ok&&data?.ok!==false,status:r.status,invocation_id:data?.invocation_id||null,result:data?.result||null,requires_confirmation:Boolean(data?.requires_confirmation),error:data?.error||null};
}

async function persistMemory(service:any,updates:any[],userId:string|null,contactId:string|null,threadRef:string|null){
  if(!userId&&!contactId)return 0;
  let n=0;
  for(const item of updates.slice(0,8)){
    const key=safeShort(item?.key,80);
    if(!SAFE_MEMORY.has(key)||item?.explicit!==true||item?.value===undefined||item?.value===null)continue;
    let q=service.from("dimpho_customer_memory").select("id").eq("memory_key",key).eq("status","active");
    q=userId?q.eq("user_id",userId):q.eq("contact_id",contactId).is("user_id",null);
    const existing=(await q.limit(1).maybeSingle()).data;
    const patch={value:item.value,category:"preference",sensitivity:"low",source:"conversation",source_ref:threadRef,confidence:.9,consent_basis:"service_context",status:"active",updated_at:new Date().toISOString(),metadata:{release:RELEASE,explicit:true}};
    const res=existing?await service.from("dimpho_customer_memory").update(patch).eq("id",existing.id):await service.from("dimpho_customer_memory").insert({...patch,user_id:userId,contact_id:userId?contactId:null});
    if(!res.error)n++;
  }
  return n;
}

async function persistState(service:any,result:any,userId:string|null,contactId:string|null,channel:string,threadRef:string|null,toolKeys:string[]){
  if(!threadRef||(!userId&&!contactId))return null;
  const current=(await service.from("dimpho_conversation_state").select("*").eq("channel",channel).eq("thread_ref",threadRef).maybeSingle()).data;
  const cs=result.conversation_state||{};
  const completed=[...new Set([...(current?.completed_actions||[]),...(Array.isArray(cs.completed_actions)?cs.completed_actions.map((x:any)=>safeShort(x,80)).filter(Boolean):[])])].slice(-30);
  const row={channel,thread_ref:threadRef,user_id:userId,contact_id:contactId,current_intent:result.intent||current?.current_intent||null,current_goal:result.goal||current?.current_goal||null,state:{release:RELEASE,last_tool_keys:toolKeys},entities:{...(current?.entities||{}),...cleanObject(cs.entities,SAFE_ENTITY)},selected_items:cleanObject(cs.selected_items,new Set(["residence_id","residence_slug","application_id","opportunity_id"])),completed_actions:completed,pending_action:safeShort(cs.pending_action,120)||null,active_workflow_key:safeShort(cs.active_workflow_key,100)||current?.active_workflow_key||null,current_step_key:safeShort(cs.current_step_key,100)||current?.current_step_key||null,turn_count:Number(current?.turn_count||0)+1,last_user_message_at:new Date().toISOString(),last_agent_message_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*24*3600_000).toISOString(),metadata:{release:RELEASE,privacy_filtered:true},updated_at:new Date().toISOString()};
  const up=await service.from("dimpho_conversation_state").upsert(row,{onConflict:"channel,thread_ref"}).select("id,active_workflow_key,current_step_key").single();
  return up.data||null;
}

async function persistWorkflow(service:any,state:any,userId:string|null,contactId:string|null,channel:string,threadRef:string|null){
  if(!state?.active_workflow_key||!threadRef)return null;
  const workflow=(await service.from("dimpho_app_workflows").select("id,workflow_key,dimpho_app_workflow_steps(step_key,step_order)").eq("workflow_key",state.active_workflow_key).eq("status","active").maybeSingle()).data;
  if(!workflow)return null;
  const stepKey=state.current_step_key||null;
  const steps=Array.isArray(workflow.dimpho_app_workflow_steps)?workflow.dimpho_app_workflow_steps:[];
  const step=steps.find((x:any)=>x.step_key===stepKey);
  let run=(await service.from("dimpho_workflow_runs").select("*").eq("workflow_id",workflow.id).eq("channel",channel).eq("thread_ref",threadRef).in("status",["active","paused"]).order("last_progress_at",{ascending:false}).limit(1).maybeSingle()).data;
  if(!run){const ins=await service.from("dimpho_workflow_runs").insert({workflow_id:workflow.id,workflow_key:workflow.workflow_key,user_id:userId,contact_id:contactId,channel,thread_ref:threadRef,status:"active",current_step_key:stepKey,current_step_order:step?.step_order||null,input_context:{release:RELEASE},working_state:{resumed_by_dimpho:true},metadata:{release:RELEASE}}).select("*").single();run=ins.data;}
  else await service.from("dimpho_workflow_runs").update({status:"active",current_step_key:stepKey||run.current_step_key,current_step_order:step?.step_order||run.current_step_order,last_progress_at:new Date().toISOString(),metadata:{...(run.metadata||{}),release:RELEASE}}).eq("id",run.id);
  if(run?.id)await service.from("dimpho_workflow_events").insert({workflow_run_id:run.id,event_type:"agent_progress",step_key:stepKey||run.current_step_key,actor_type:"dimpho",payload:{release:RELEASE}});
  return run?.id||null;
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey||!anonKey)return json({error:"Supabase runtime is not configured"},500);
  const started=Date.now();
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||body.task||"general");
  const openaiKey=env("OPENAI_API_KEY"),lovableKey=env("LOVABLE_API_KEY");
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});

  if(action==="health"){
    const existing=await service.from("adminos_integration_connections").select("status,enabled").eq("provider","openai").maybeSingle();
    let verification:any={ok:existing.data?.status==="connected"&&existing.data?.enabled===true,model:routineModel,error:null};
    if(openaiKey&&!verification.ok){verification=await probeOpenAIKey(openaiKey);await setOpenAIConnection(service,verification,false);}
    const [overview,routine,complex,gate]=await Promise.all([service.rpc("dimpho_intelligence_overview"),modelRoute(service,"routine"),modelRoute(service,"complex"),service.rpc("dimpho_latest_eval_gate",{p_suite_key:"production_gate"})]);
    return json({ok:Boolean(verification.ok||lovableKey),primary:verification.ok?"openai":null,fallback:lovableKey?"lovable_gateway":null,openai_configured:Boolean(openaiKey),openai_verified:Boolean(verification.ok),models:{routine:routine?.model_name,complex:complex?.model_name,fallback:routine?.fallback_model_name},intelligence_release:RELEASE,overview:overview.data||null,model_routes:{routine,complex},latest_eval_gate:gate.data||{}});
  }

  const authHeader=req.headers.get("Authorization")||"";
  const authClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
  const {data:userData}=await authClient.auth.getUser();
  const user=userData?.user||null;
  const internalService=authHeader===`Bearer ${serviceKey}`;
  let staffRole:string|null=null;
  if(user){const x=await service.rpc("get_user_staff_role",{_user_id:user.id});staffRole=x.data||null;}
  if(action==="test"){
    if((!user||!staffRole)&&!internalService)return json({error:"Staff access required"},403);
    const test=await runOpenAITest(openaiKey);await setOpenAIConnection(service,test,true);
    return test.ok?json({ok:true,openai_configured:true,openai_verified:true,primary:"openai",model:test.model||routineModel,response_id:test.response_id||null}):json({error:test.error,openai_configured:Boolean(openaiKey),openai_verified:false},503);
  }
  if(!user&&!internalService&&action!=="public_enquiry")return json({error:"Authentication required"},401);
  if(!["public_enquiry","enquiry_reply"].includes(action)&&!staffRole&&!internalService)return json({error:"Staff access required"},403);

  const contactId=body.contact_id?safeShort(body.contact_id,64):null;
  let contact:any=null;
  if(contactId){const c=await service.from("adminos_contacts").select("*").eq("id",contactId).maybeSingle();contact=c.data;if(!staffRole&&!internalService&&action==="enquiry_reply"&&contact?.profile_user_id!==user?.id)return json({error:"Contact access denied"},403);}
  const {data:cfg}=await service.from("adminos_agent_config").select("*").eq("agent_key","konnect_agent").maybeSingle();
  if(!cfg?.enabled)return json({error:"Konnect Agent is paused by AdminOS"},503);
  const threshold=Number(cfg.confidence_threshold||.86);
  const message=String(body.message||body.content||"").slice(0,12000);
  if(!message.trim())return json({error:"Message is required"},400);

  const {data:promptRow}=await service.from("adminos_agent_prompt_versions").select("system_prompt,policy,tool_allowlist,version").eq("agent_key","konnect_agent").eq("active",true).maybeSingle();
  const intelligence=await loadIntelligence(service,message,openaiKey);
  const contextUserId=contact?.profile_user_id||user?.id||body.context_user_id||null;
  const channel=safeShort(body.context?.channel||body.channel||"web",40)||"web";
  const threadRef=safeShort(body.thread_id||body.context?.thread?.id||body.context?.thread_id,100)||null;
  let customer360:any={};
  if(contextUserId||contactId){try{customer360=(await service.rpc("dimpho_customer_context_snapshot",{p_user_id:contextUserId,p_contact_id:contactId})).data||{};}catch{/* best effort */}}
  let history:any[]=Array.isArray(body.context?.conversation_history)?body.context.conversation_history:[];
  if(!history.length&&body.thread_id){const h=await service.from("adminos_enquiry_messages").select("sender_type,content,created_at").eq("thread_id",String(body.thread_id)).order("created_at",{ascending:true}).limit(16);history=h.data||[];}
  const trustedContext={task:action,channel,contact:action==="public_enquiry"&&!contactId?null:contact?{id:contact.id,full_name:contact.full_name,campus:contact.campus,student_number:contact.student_number,contact_type:contact.contact_type}:null,customer360,history,knowledge:intelligence.knowledge.map((k:any)=>({title:k.title,content:k.content,source_type:k.source_type,source_ref:k.source_ref,confidence:k.confidence,score:k.score})),app_workflows:intelligence.workflows,training_examples:intelligence.training_examples,available_tools:intelligence.tools,additional_context:body.context||null};

  const highComplexity=body.complexity==="high"||message.length>4500||/(compare|why|explain|problem|not working|application status|eligib|route|documents|complaint)/i.test(message);
  const routeKey=highComplexity?"complex":"routine";
  const route=await modelRoute(service,routeKey);
  const model=route?.model_name||(highComplexity?complexModel:routineModel);
  const maxContext=Number(cfg.config?.cost_guard?.max_context_chars||30000);
  const baseSystem=intelligence.persona.compiled_prompt||promptRow?.system_prompt||"You are Dimpho, ResKonnect's AI Concierge.";
  const systemPrompt=`${baseSystem}\n\nDIMPHO INTELLIGENCE RELEASE 8 OPERATING POLICY:\n- Treat TRUSTED RESKONNECT CONTEXT and TOOL RESULTS as operational truth; learned examples are style/workflow demonstrations only.\n- Never invent availability, application status, eligibility, requirements, customer facts, URLs or private reasons. Use an available tool when live backend truth is required.\n- Never request, repeat, store or expose passwords, OTPs, banking secrets or identity numbers.\n- Use only the tools supplied in context and never claim a tool succeeded unless a TOOL RESULT says it did.\n- Persistent memory may only contain the approved low-sensitivity service preferences and only when the user explicitly states them.\n- For fraud, legal threats, bank-detail changes, security breaches or material disputes, escalate to a human.\n- Return JSON only.`;
  const schemaInstruction=`Return one JSON object with answer:string, confidence:number 0..1, risk:green|amber|red, escalate:boolean, reason:string, intent:string|null, goal:string|null, tool_calls:array of {name,arguments,confirmed}, memory_updates:array of {key,value,explicit}, conversation_state:{entities,selected_items,completed_actions,pending_action,active_workflow_key,current_step_key}. Use at most 3 tool_calls. If live data is needed and a matching tool exists, request it instead of guessing.`;
  const userPrompt=`TASK: ${action}\nUSER MESSAGE:\n${message}\n\nTRUSTED RESKONNECT CONTEXT JSON:\n${JSON.stringify(trustedContext).slice(0,maxContext)}\n\n${schemaInstruction}`;

  const run=await service.from("adminos_agent_runs").insert({agent_key:"konnect_agent",trigger_type:action,trigger_id:threadRef,status:"running",input:{contact_id:contactId,message:message.slice(0,2000),model,route_key:routeKey,intelligence_release:RELEASE,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length,workflow_count:intelligence.workflows.length,training_examples:intelligence.training_examples.length},created_by:user?.id||null}).select("id").single();
  if(run.error||!run.data)return json({error:"Could not start agent run"},500);
  await service.from("dimpho_router_decisions").insert({agent_run_id:run.data.id,route_key:routeKey,model_id:route?.model_id||null,provider:route?.provider||"openai",model_name:model,reason:highComplexity?"complexity_router":"routine_router",input_summary:{message_chars:message.length,channel,complexity:highComplexity?"high":"routine"}});

  let first=await callAI(openaiKey,lovableKey,route,systemPrompt,userPrompt,Number(route?.config?.max_output_tokens||cfg.config?.max_output_tokens||900));
  if(!first.raw){await service.from("adminos_agent_runs").update({status:"failed",completed_at:new Date().toISOString(),output:{error:first.lastError||"No AI provider configured"}}).eq("id",run.data.id);return json({error:"AI provider unavailable",detail:first.lastError||null,escalate:true},503);}
  let result=parseAgentJson(first.raw);
  const toolResults:any[]=[];
  for(const call of result.tool_calls){const known=intelligence.tools.some((t:any)=>t.tool_key===call.name);if(!known){toolResults.push({tool:call.name,ok:false,error:"Tool is not registered"});continue;}toolResults.push(await invokeTool(call,{actorUserId:user?.id||null,userId:contextUserId,contactId,threadRef,channel},run.data.id,message));}

  let finalProvider=first.provider,finalModel=first.usedModel,usage=first.usage;
  if(toolResults.length){
    const follow=`${userPrompt}\n\nTRUSTED TOOL RESULTS JSON:\n${JSON.stringify(toolResults).slice(0,18000)}\n\nNow produce the final customer-facing JSON. Do not request additional tools in this turn. Reflect tool failures/confirmation requirements accurately.`;
    const second=await callAI(openaiKey,lovableKey,route,systemPrompt,follow,Number(route?.config?.max_output_tokens||cfg.config?.max_output_tokens||900));
    if(second.raw){result=parseAgentJson(second.raw);result.tool_calls=[];finalProvider=second.provider;finalModel=second.usedModel;usage={input_tokens:Number(first.usage?.input_tokens||first.usage?.prompt_tokens||0)+Number(second.usage?.input_tokens||second.usage?.prompt_tokens||0),output_tokens:Number(first.usage?.output_tokens||first.usage?.completion_tokens||0)+Number(second.usage?.output_tokens||second.usage?.completion_tokens||0)};}
  }

  if(result.confidence<threshold){result.escalate=true;if(result.risk==="green")result.risk="amber";result.reason=result.reason||`Confidence below ${threshold}`;}
  if(/(bank\s*details|change\s*bank|lawyer|legal action|fraud|breach|liability|sign\s*(a|the)?\s*lease|refund dispute|threat)/i.test(message)){result.escalate=true;if(result.risk==="green")result.risk="amber";}
  const memorySaved=await persistMemory(service,result.memory_updates||[],contextUserId,contactId,threadRef);
  const toolKeys=toolResults.filter((x)=>x.ok).map((x)=>x.tool);
  const state=await persistState(service,result,contextUserId,contactId,channel,threadRef,toolKeys);
  const workflowRunId=await persistWorkflow(service,state,contextUserId,contactId,channel,threadRef);

  if(result.escalate||result.confidence<.78||intelligence.knowledge.length===0){try{await service.rpc("adminos_record_learning_gap",{p_question:message,p_thread_id:threadRef,p_contact_id:contactId,p_reason:result.reason||"Dimpho could not verify enough context",p_category:result.escalate?"escalated_question":"knowledge_gap",p_metadata:{run_id:run.data.id,intelligence_release:RELEASE,knowledge_hits:intelligence.knowledge.length,confidence:result.confidence,tool_keys:toolKeys}});}catch{/* best effort */}}
  await service.from("adminos_agent_runs").update({status:result.escalate?"awaiting_approval":"succeeded",output:{...result,tool_results:toolResults,intelligence:{release:RELEASE,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length,workflow_count:intelligence.workflows.length,training_examples:intelligence.training_examples.length,memory_saved:memorySaved,workflow_run_id:workflowRunId}},completed_at:new Date().toISOString()}).eq("id",run.data.id);
  await service.from("adminos_agent_actions").insert({run_id:run.data.id,agent_key:"konnect_agent",action_type:action,entity_type:body.entity_type||null,entity_id:body.entity_id||threadRef,authority_level:result.risk,confidence:result.confidence,reason:result.reason,tool_name:toolKeys.length?"dimpho_tool_engine":"dimpho_intelligence_reasoner",request_payload:{provider:finalProvider,model:finalModel,route_key:routeKey,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length},response_payload:{answer:result.answer,tool_keys:toolKeys,escalate:result.escalate},status:result.escalate?"awaiting_approval":"executed",executed_at:result.escalate?null:new Date().toISOString()});
  const inputTokens=Number(usage?.input_tokens??usage?.prompt_tokens??0)||null,outputTokens=Number(usage?.output_tokens??usage?.completion_tokens??0)||null;
  await service.from("adminos_agent_usage").insert({run_id:run.data.id,agent_key:"konnect_agent",provider:finalProvider,model:finalModel,input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost_usd:finalProvider==="openai"?costFor(finalModel,inputTokens||0,outputTokens||0):null,latency_ms:Date.now()-started});
  return json({answer:result.answer,confidence:result.confidence,risk:result.risk,escalate:result.escalate,reason:result.reason,run_id:run.data.id,provider:finalProvider,model:finalModel,model_route:routeKey,threshold,intelligence_release:RELEASE,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length,workflow_count:intelligence.workflows.length,learned_examples:intelligence.training_examples.length,tool_keys:toolKeys,tool_results:toolResults.map((x)=>({tool:x.tool,ok:x.ok,status:x.status,requires_confirmation:x.requires_confirmation,invocation_id:x.invocation_id})),memory_saved:memorySaved,workflow_run_id:workflowRunId});
});
