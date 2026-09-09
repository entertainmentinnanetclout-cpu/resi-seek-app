import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
const env=(name:string)=>Deno.env.get(name)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const routineModel="gpt-5.6-luna";
const complexModel="gpt-5.6-terra";
const PUBLIC_BASE="https://www.reskonnect.org";

const extractText=(data:any)=>{if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&typeof part?.text==="string")return part.text;return data?.choices?.[0]?.message?.content||"";};
const sanitizeResKonnectLinks=(value:string)=>String(value||"").replace(/https:\/\/reskonnect\.org/gi,PUBLIC_BASE).replace(/https:\/\/www\.reskonnect\.org/gi,PUBLIC_BASE).replace(/https:\/\/www\.reskonnect\.org(?:\/[^\s<>]*)?/gi,(raw)=>{let cleaned=raw.replace(/[.,;:!?]+$/g,"");while(/[)\]}]$/.test(cleaned))cleaned=cleaned.slice(0,-1);try{const url=new URL(cleaned);if(url.origin!==PUBLIC_BASE)return PUBLIC_BASE;const bare=url.pathname.replace(/\/+$/,"")||"/";if(bare==="/find-my-res")url.pathname="/find";if(bare==="/findmyres")url.pathname="/find";url.hostname="www.reskonnect.org";url.protocol="https:";return url.toString().replace(/\/$/,url.pathname==="/"?"/":"");}catch{return PUBLIC_BASE;}});
const parseAgentJson=(raw:string)=>{const cleaned=raw.trim().replace(/^```json\s*/i,"").replace(/```$/i,"").trim();try{const p=JSON.parse(cleaned);return{answer:sanitizeResKonnectLinks(String(p.answer||"")),confidence:Math.max(0,Math.min(1,Number(p.confidence??0.75))),risk:["green","amber","red"].includes(p.risk)?p.risk:"amber",escalate:Boolean(p.escalate),reason:String(p.reason||"")};}catch{return{answer:sanitizeResKonnectLinks(raw.trim()),confidence:0.72,risk:"amber",escalate:true,reason:"Model output was not structured."};}};
const costFor=(model:string,input=0,output=0)=>{const rates:Record<string,[number,number]>={"gpt-5.6-luna":[0.20,1.20],"gpt-5.6-terra":[2.00,12.00],"gpt-5.6-sol":[4.00,20.00]};const[ri,ro]=rates[model]||[0,0];return(input/1_000_000)*ri+(output/1_000_000)*ro;};

async function probeOpenAIKey(key:string){if(!key)return{ok:false,error:"OPENAI_API_KEY is not configured"};const r=await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(routineModel)}`,{headers:{Authorization:`Bearer ${key}`}});const d=await r.json().catch(()=>({}));if(!r.ok)return{ok:false,error:d?.error?.message||`OpenAI HTTP ${r.status}`};return{ok:true,model:d?.id||routineModel,owned_by:d?.owned_by||"openai"};}
async function runOpenAITest(key:string){if(!key)return{ok:false,error:"OPENAI_API_KEY is not configured"};const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:routineModel,input:"Reply with exactly: OK",reasoning:{effort:"none"},max_output_tokens:16})});const d=await r.json().catch(()=>({}));if(!r.ok)return{ok:false,error:d?.error?.message||`OpenAI HTTP ${r.status}`};return{ok:true,model:d?.model||routineModel,response_id:d?.id||null,output_text:extractText(d)};}
async function setOpenAIConnection(service:any,result:any,tested=false){const now=new Date().toISOString();const patch=result.ok?{status:"connected",enabled:true,setup_step:3,external_account_label:`OpenAI API · ${result.model||routineModel}`,last_tested_at:tested?now:undefined,last_success_at:now,last_error:null,last_error_at:null}:{status:"needs_action",enabled:false,setup_step:2,last_tested_at:tested?now:undefined,last_error:result.error||"OpenAI verification failed",last_error_at:now};await service.from("adminos_integration_connections").update(Object.fromEntries(Object.entries(patch).filter(([,v])=>v!==undefined))).eq("provider","openai");}
async function queryEmbedding(key:string,message:string,model:string){if(!key||!message.trim())return null;try{const r=await fetch("https://api.openai.com/v1/embeddings",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:message.slice(0,8000)})});const d=await r.json().catch(()=>({}));if(!r.ok)return null;const v=d?.data?.[0]?.embedding;return Array.isArray(v)?`[${v.join(",")}]`:null;}catch{return null;}}

async function loadIntelligence(service:any,message:string,openaiKey:string){
  const [{data:persona},{data:settings},{data:workflows},{data:examples}]=await Promise.all([
    service.from("dimpho_personas").select("id,name,role_title,mission,active_version_id,dimpho_persona_versions!dimpho_personas_active_version_fk(version,compiled_prompt,system_prompt_template,sliders,channel_overrides)").eq("persona_key","dimpho").maybeSingle(),
    service.from("dimpho_intelligence_settings").select("embedding_model,reasoning_model,learning_enabled").eq("id",1).maybeSingle(),
    service.from("dimpho_app_workflows").select("workflow_key,name,description,entry_route,success_state,dimpho_app_workflow_steps(step_order,step_key,title,instruction,route_path,requirements,backend_checks,failure_recovery)").eq("status","active").order("name").limit(8),
    service.from("dimpho_training_examples").select("category,channel,user_input,ideal_output,tags,quality_score").eq("active",true).order("quality_score",{ascending:false}).limit(8),
  ]);
  const embedModel=settings?.embedding_model||"text-embedding-3-small";
  const embedding=await queryEmbedding(openaiKey,message,embedModel);
  let knowledge:any[]=[];
  try{const {data}=await service.rpc("dimpho_search_knowledge",{p_query:message,p_embedding_text:embedding,p_limit:10,p_min_confidence:0.55});knowledge=data||[];}catch{knowledge=[];}
  const activeVersion=Array.isArray(persona?.dimpho_persona_versions)?persona.dimpho_persona_versions[0]:persona?.dimpho_persona_versions;
  return{
    persona:{name:persona?.name||"Dimpho",role_title:persona?.role_title||"ResKonnect AI Concierge",version:activeVersion?.version||null,compiled_prompt:activeVersion?.compiled_prompt||activeVersion?.system_prompt_template||null,sliders:activeVersion?.sliders||null,channel_overrides:activeVersion?.channel_overrides||null},
    settings:settings||{},knowledge,workflows:workflows||[],training_examples:examples||[],embedding_used:Boolean(embedding)
  };
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey||!anonKey)return json({error:"Supabase runtime is not configured"},500);
  const started=Date.now();
  const body=await req.json().catch(()=>({}));
  const action=String(body.action||body.task||"general");
  const openaiKey=env("OPENAI_API_KEY");
  const lovableKey=env("LOVABLE_API_KEY");
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});

  if(action==="health"){
    const existing=await service.from("adminos_integration_connections").select("status,enabled").eq("provider","openai").maybeSingle();
    let verification:any={ok:existing.data?.status==="connected"&&existing.data?.enabled===true,model:routineModel,error:null};
    if(openaiKey&&!verification.ok){verification=await probeOpenAIKey(openaiKey);await setOpenAIConnection(service,verification,false);}else if(!openaiKey&&existing.data?.status==="connected"){verification={ok:false,error:"OPENAI_API_KEY is not configured",model:routineModel};await setOpenAIConnection(service,verification,false);}
    const {data:overview}=await service.rpc("dimpho_intelligence_overview").catch(()=>({data:null}));
    return json({ok:Boolean(verification.ok||lovableKey),primary:verification.ok?"openai":null,fallback:lovableKey?"lovable_gateway":null,openai_configured:Boolean(openaiKey),openai_verified:Boolean(verification.ok),model:verification.model||routineModel,error:verification.error||null,models:{routine:routineModel,complex:complexModel,fallback:"google/gemini-2.5-flash"},intelligence_release:4,overview});
  }

  const authHeader=req.headers.get("Authorization")||"";
  const authClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}}});
  const {data:userData}=await authClient.auth.getUser();
  const user=userData?.user||null;
  let staffRole:string|null=null;
  if(user){const {data}=await service.rpc("get_user_staff_role",{_user_id:user.id});staffRole=data||null;}
  if(action==="test"){if(!user||!staffRole)return json({error:"Staff access required"},403);const test=await runOpenAITest(openaiKey);await setOpenAIConnection(service,test,true);if(!test.ok)return json({error:test.error,openai_configured:Boolean(openaiKey),openai_verified:false},503);return json({ok:true,openai_configured:true,openai_verified:true,primary:"openai",model:test.model||routineModel,response_id:test.response_id||null});}
  if(!user&&action!=="public_enquiry")return json({error:"Authentication required"},401);
  if(!["public_enquiry","enquiry_reply"].includes(action)&&!staffRole)return json({error:"Staff access required"},403);

  const contactId=body.contact_id?String(body.contact_id):null;
  let contact:any=null;
  if(contactId){const {data}=await service.from("adminos_contacts").select("*").eq("id",contactId).maybeSingle();contact=data;if(!staffRole&&action==="enquiry_reply"&&contact?.profile_user_id!==user?.id)return json({error:"Contact access denied"},403);}
  const {data:cfg}=await service.from("adminos_agent_config").select("*").eq("agent_key","konnect_agent").maybeSingle();
  if(!cfg?.enabled)return json({error:"Konnect Agent is paused by AdminOS"},503);
  const threshold=Number(cfg.confidence_threshold||0.86);
  const message=String(body.message||body.content||"").slice(0,12000);
  if(!message.trim())return json({error:"Message is required"},400);

  const {data:promptRow}=await service.from("adminos_agent_prompt_versions").select("system_prompt,policy,tool_allowlist,version").eq("agent_key","konnect_agent").eq("active",true).maybeSingle();
  const intelligence=await loadIntelligence(service,message,openaiKey);
  const systemPrompt=intelligence.persona.compiled_prompt||promptRow?.system_prompt||"You are Dimpho, ResKonnect's AI Concierge. Return JSON only with answer, confidence, risk, escalate, reason.";

  let applications:any[]=[];
  if(contact?.profile_user_id){const apps=await service.from("applications").select("id,status,funding_type,created_at,updated_at,residence_id,residences(name,campus,price,available_spots)").eq("user_id",contact.profile_user_id).order("updated_at",{ascending:false}).limit(8);applications=apps.data||[];}
  let history:any[]=Array.isArray(body.context?.conversation_history)?body.context.conversation_history:[];
  if(!history.length&&body.thread_id){const h=await service.from("adminos_enquiry_messages").select("sender_type,content,created_at").eq("thread_id",String(body.thread_id)).order("created_at",{ascending:true}).limit(16);history=h.data||[];}
  const context={task:action,channel:body.context?.channel||null,contact:action==="public_enquiry"?null:contact?{id:contact.id,full_name:contact.full_name,campus:contact.campus,student_number:contact.student_number,contact_type:contact.contact_type}:null,applications,history,knowledge:intelligence.knowledge.map((k:any)=>({title:k.title,content:k.content,source_type:k.source_type,source_ref:k.source_ref,confidence:k.confidence,score:k.score})),app_workflows:intelligence.workflows,training_examples:intelligence.training_examples,additional_context:body.context||null};
  const highComplexity=body.complexity==="high"||message.length>4500||/(compare|why|explain|problem|not working|application status|eligib|route|documents)/i.test(message);
  const model=highComplexity?(cfg.config?.complex_model||complexModel):(cfg.config?.primary_model||routineModel);
  const maxContext=Number(cfg.config?.cost_guard?.max_context_chars||26000);
  const userPrompt=`TASK: ${action}\nUSER MESSAGE:\n${message}\n\nTRUSTED RESKONNECT CONTEXT JSON:\n${JSON.stringify(context).slice(0,maxContext)}\n\nUse the trusted context as operational truth. Learned examples are style/workflow demonstrations, never proof of live facts. If the backend does not verify a live fact, do not invent it. Return only valid JSON with answer:string, confidence:number 0..1, risk:green|amber|red, escalate:boolean, reason:string.`;

  const {data:run,error:runErr}=await service.from("adminos_agent_runs").insert({agent_key:"konnect_agent",trigger_type:action,trigger_id:body.thread_id||body.context?.thread?.id||null,status:"running",input:{contact_id:contactId,message:message.slice(0,2000),model,intelligence_release:4,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length,workflow_count:intelligence.workflows.length,training_examples:intelligence.training_examples.length},created_by:user?.id||null}).select("id").single();
  if(runErr||!run)return json({error:"Could not start agent run"},500);

  let provider="",usedModel=model,raw="",usage:any={},lastError="";
  if(openaiKey){try{const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openaiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"system",content:[{type:"input_text",text:systemPrompt}]},{role:"user",content:[{type:"input_text",text:userPrompt}]}],max_output_tokens:Number(cfg.config?.max_output_tokens||850)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`OpenAI HTTP ${r.status}`);raw=extractText(d);usage=d?.usage||{};provider="openai";await service.from("adminos_integration_connections").update({status:"connected",enabled:true,setup_step:3,external_account_label:`OpenAI API · ${model}`,last_success_at:new Date().toISOString(),last_error:null,last_error_at:null}).eq("provider","openai");}catch(e){lastError=e instanceof Error?e.message:String(e);await service.from("adminos_integration_connections").update({status:"error",enabled:false,setup_step:2,last_error:lastError,last_error_at:new Date().toISOString()}).eq("provider","openai");}}
  if(!raw&&lovableKey){try{usedModel=cfg.config?.fallback_model||"google/gemini-2.5-flash";const r=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${lovableKey}`,"Content-Type":"application/json"},body:JSON.stringify({model:usedModel,messages:[{role:"system",content:systemPrompt},{role:"user",content:userPrompt}],max_tokens:Number(cfg.config?.max_output_tokens||850)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error?.message||`AI gateway HTTP ${r.status}`);raw=extractText(d);usage=d?.usage||{};provider="lovable_gateway";}catch(e){lastError=e instanceof Error?e.message:String(e);}}
  if(!raw){await service.from("adminos_agent_runs").update({status:"failed",completed_at:new Date().toISOString(),output:{error:lastError||"No AI provider configured"}}).eq("id",run.id);await service.from("adminos_agent_errors").insert({run_id:run.id,error_code:"provider_unavailable",error_message:lastError||"No AI provider configured",context:{action},retryable:true});return json({error:"AI provider unavailable",detail:lastError||null,escalate:true},503);}

  const result=parseAgentJson(raw);
  if(result.confidence<threshold){result.escalate=true;if(result.risk==="green")result.risk="amber";result.reason=result.reason||`Confidence below ${threshold}`;}
  if(/(bank\s*details|change\s*bank|lawyer|legal action|fraud|breach|liability|sign\s*(a|the)?\s*lease|refund dispute|threat)/i.test(message)){result.escalate=true;if(result.risk==="green")result.risk="amber";}
  if(result.escalate||result.confidence<0.78||intelligence.knowledge.length===0){try{await service.rpc("adminos_record_learning_gap",{p_question:message,p_thread_id:body.thread_id||body.context?.thread?.id||null,p_contact_id:contactId,p_reason:result.reason||"Dimpho could not verify enough context",p_category:result.escalate?"escalated_question":"knowledge_gap",p_metadata:{run_id:run.id,intelligence_release:4,knowledge_hits:intelligence.knowledge.length,confidence:result.confidence}});}catch{/* learning queue is best effort */}}

  await service.from("adminos_agent_runs").update({status:result.escalate?"awaiting_approval":"succeeded",output:{...result,intelligence:{persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length,workflow_count:intelligence.workflows.length,training_examples:intelligence.training_examples.length}},completed_at:new Date().toISOString()}).eq("id",run.id);
  await service.from("adminos_agent_actions").insert({run_id:run.id,agent_key:"konnect_agent",action_type:action,entity_type:body.entity_type||null,entity_id:body.entity_id||body.thread_id||body.context?.thread?.id||null,authority_level:result.risk,confidence:result.confidence,reason:result.reason,tool_name:"dimpho_intelligence_reasoner",request_payload:{provider,model:usedModel,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length},response_payload:result,status:result.escalate?"awaiting_approval":"executed",executed_at:result.escalate?null:new Date().toISOString()});
  const inputTokens=Number(usage?.input_tokens??usage?.prompt_tokens??0)||null,outputTokens=Number(usage?.output_tokens??usage?.completion_tokens??0)||null;
  await service.from("adminos_agent_usage").insert({run_id:run.id,agent_key:"konnect_agent",provider,model:usedModel,input_tokens:inputTokens,output_tokens:outputTokens,estimated_cost_usd:provider==="openai"?costFor(usedModel,inputTokens||0,outputTokens||0):null,latency_ms:Date.now()-started});
  return json({...result,run_id:run.id,provider,model:usedModel,threshold,intelligence_release:4,persona_version:intelligence.persona.version,knowledge_hits:intelligence.knowledge.length,workflow_count:intelligence.workflows.length,learned_examples:intelligence.training_examples.length});
});