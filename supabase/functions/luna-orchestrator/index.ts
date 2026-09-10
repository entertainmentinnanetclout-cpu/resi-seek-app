import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-luna-cron-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(name:string)=>Deno.env.get(name)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const openAIKey=env("OPENAI_API_KEY");
const RELEASE=1;
const PHASE=2;
const safe=(v:unknown,max=240)=>String(v??"").trim().slice(0,max);
const extractText=(data:any)=>{if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&typeof part?.text==="string")return part.text;return "";};
const costFor=(model:string,input=0,output=0)=>{const rates:Record<string,[number,number]>={"gpt-5.6-luna":[.20,1.20],"gpt-5.6-terra":[2,12],"gpt-5.6-sol":[4,20]};const [ri,ro]=rates[model]||[0,0];return input/1e6*ri+output/1e6*ro;};
const secureEqual=(a:string,b:string)=>{if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const slug=(v:unknown)=>safe(v,180).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const scale=(n:number,mult=18)=>Math.min(100,Math.round(mult*Math.log1p(Math.max(0,n))));

async function authorize(req:Request,service:any){
  const cron=req.headers.get("x-luna-cron-token")||"";
  if(cron){const {data}=await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key","luna_demand").maybeSingle();if(secureEqual(cron,data?.secret_value||""))return{ok:true,actor:"scheduler",userId:null};}
  const authHeader=req.headers.get("Authorization")||"";
  if(!authHeader||!anonKey)return{ok:false,actor:null,userId:null};
  const auth=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
  const {data}=await auth.auth.getUser();const user=data?.user;
  if(!user)return{ok:false,actor:null,userId:null};
  const role=await service.rpc("get_user_staff_role",{_user_id:user.id});
  return{ok:Boolean(role.data),actor:role.data?"staff":null,userId:role.data?user.id:null};
}

async function hash(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}

function campusResolver(campuses:any[]){
  const index=new Map<string,string>();
  for(const c of campuses){const key=String(c.campus_key||slug(c.name));for(const value of [key,c.name,c.short_name,...(Array.isArray(c.aliases)?c.aliases:[])]){const k=slug(value);if(k)index.set(k,key);}}
  return(value:unknown)=>{const raw=slug(value);if(!raw)return"unspecified";if(index.has(raw))return index.get(raw)!;for(const [alias,key] of index){if(raw.includes(alias)||alias.includes(raw))return key;}return raw;};
}

async function narrative(prompt:string,model:string,ranked:any[],sourceCounts:any){
  if(!openAIKey)return{summary:null,provider:null,model:null,usage:null};
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openAIKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,input:[{role:"system",content:[{type:"input_text",text:prompt}]},{role:"user",content:[{type:"input_text",text:JSON.stringify({ranked_opportunities:ranked.slice(0,8),source_counts:sourceCounts})}]}],max_output_tokens:350})});
  const data=await r.json().catch(()=>({}));if(!r.ok)return{summary:null,provider:null,model:null,usage:null};
  return{summary:safe(extractText(data),2400)||null,provider:"openai",model:data?.model||model,usage:data?.usage||null};
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey)return json({error:"Supabase runtime is not configured"},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const authz=await authorize(req,service);if(!authz.ok)return json({error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({}));const action=safe(body?.action||"health",80);
  const days=[7,30,90].includes(Number(body?.days))?Number(body.days):30;
  const {data:agentConfig}=await service.from("adminos_agent_config").select("enabled,config").eq("agent_key","luna_demand").maybeSingle();
  if(!agentConfig?.enabled)return json({error:"Luna Demand Intelligence is disabled"},503);
  if(action==="health"){
    const {data:latest}=await service.from("adminos_demand_snapshots").select("id,generated_at,status,source_counts").order("generated_at",{ascending:false}).limit(1).maybeSingle();
    return json({ok:true,identity:"luna_demand",release:RELEASE,phase:PHASE,latest:latest||null});
  }
  if(action==="latest"){
    const {data:latest}=await service.from("adminos_demand_snapshots").select("*").order("generated_at",{ascending:false}).limit(1).maybeSingle();
    return json({ok:true,latest:latest||null,release:RELEASE,phase:PHASE});
  }
  if(action!=="demand_cycle")return json({error:"Unsupported action"},400);

  const run=await service.from("adminos_agent_runs").insert({agent_key:"luna_demand",trigger_type:"demand_cycle",status:"running",input:{days,source:safe(body?.source||authz.actor,80)},created_by:authz.userId}).select("id").single();
  const runId=run.data?.id||null;const started=Date.now();
  try{
    const since=new Date(Date.now()-days*86400000).toISOString();
    const [supplyR,demandR,institutionR,opportunityR,eventR,campusR,waR,appR,promptR]=await Promise.all([
      service.rpc("housing_intel_supply_live"),
      service.rpc("housing_intel_demand_heat",{p_days:days}),
      service.rpc("housing_intel_institution_snapshot",{p_days:days}),
      service.rpc("housing_intel_opportunities",{p_days:days}),
      service.rpc("luna_demand_event_summary",{p_days:days}),
      service.from("resmap_campuses").select("campus_key,name,short_name,aliases").eq("is_active",true),
      service.from("adminos_whatsapp_conversion_leads").select("campus,stage,created_at,converted_at").gte("created_at",since).limit(5000),
      service.from("applications").select("id,status,created_at,residence_id,residences(campus)").gte("created_at",since).limit(5000),
      service.from("adminos_agent_prompt_versions").select("system_prompt").eq("agent_key","luna_demand").eq("active",true).order("version",{ascending:false}).limit(1).maybeSingle(),
    ]);
    const error=supplyR.error||demandR.error||institutionR.error||opportunityR.error||eventR.error||campusR.error||waR.error||appR.error;if(error)throw error;
    const supply=supplyR.data||[], demand=demandR.data||[], institutions=institutionR.data||[], housingOpps=opportunityR.data||[], events=eventR.data||[];
    const resolve=campusResolver(campusR.data||[]);
    const demandMap=new Map(demand.map((x:any)=>[String(x.campus_key),x]));
    const oppMap=new Map(housingOpps.map((x:any)=>[String(x.campus_key),x]));
    const eventMap=new Map<string,{searches:number,visitors:number}>();
    for(const e of events){const key=resolve(e.campus);const prev=eventMap.get(key)||{searches:0,visitors:0};if(["residence_search","filter_change"].includes(String(e.event_type))){prev.searches+=Number(e.event_count||0);prev.visitors+=Number(e.unique_visitors||0);}eventMap.set(key,prev);}
    const waMap=new Map<string,{leads:number,converted:number}>();for(const w of waR.data||[]){const key=resolve(w.campus);const p=waMap.get(key)||{leads:0,converted:0};p.leads++;if(w.converted_at||["converted","placed","applied"].includes(String(w.stage||"").toLowerCase()))p.converted++;waMap.set(key,p);}
    const appMap=new Map<string,number>();for(const a of appR.data||[]){const relation=Array.isArray(a.residences)?a.residences[0]:a.residences;const key=resolve(relation?.campus);appMap.set(key,(appMap.get(key)||0)+1);}
    const ranked=supply.filter((s:any)=>Number(s.available_spots||0)>0).map((s:any)=>{
      const key=String(s.campus_key||resolve(s.campus_name));const d=demandMap.get(key)||{};const e=eventMap.get(key)||{searches:0,visitors:0};const w=waMap.get(key)||{leads:0,converted:0};const apps=appMap.get(key)||0;const h=oppMap.get(key)||{};
      const demandScore=Number(d.demand_index||0);const availabilityRate=Number(s.availability_rate||0);const vacancyScore=Math.min(100,Math.round(scale(Number(s.available_spots||0),14)*.65+Math.min(100,availabilityRate*1.5)*.35));const searchScore=scale(e.searches,20);const whatsappScore=scale(w.leads,22);const applicationScore=scale(apps,18);
      const campaignPriority=Math.round(demandScore*.35+vacancyScore*.30+searchScore*.15+whatsappScore*.10+applicationScore*.10);
      return{campus_key:key,campus_name:s.campus_name,campaign_priority:campaignPriority,available_spots:Number(s.available_spots||0),total_capacity:Number(s.total_capacity||0),availability_rate:availabilityRate,average_price:s.average_price==null?null:Number(s.average_price),demand_index:demandScore,demand_count:Number(d.demand_count||0),search_signals:Number(d.search_signals||0),website_searches:e.searches,website_unique_visitors:e.visitors,whatsapp_leads:w.leads,whatsapp_converted:w.converted,applications:apps,housing_opportunity_score:Number(h.opportunity_score||0),housing_signal:h.signal||null,reason:campaignPriority>=70?"high-priority demand generation":campaignPriority>=50?"rising growth opportunity":"monitor"};
    }).sort((a:any,b:any)=>b.campaign_priority-a.campaign_priority||b.available_spots-a.available_spots);
    const sourceCounts={housing_supply_campuses:supply.length,housing_demand_campuses:demand.length,demand_event_groups:events.length,whatsapp_leads:(waR.data||[]).length,applications:(appR.data||[]).length,ranked_campuses:ranked.length};
    const fingerprint=await hash(JSON.stringify(ranked.slice(0,8).map((x:any)=>[x.campus_key,x.campaign_priority,x.available_spots,x.demand_count,x.website_searches,x.whatsapp_leads,x.applications])));
    const {data:last}=await service.from("adminos_demand_snapshots").select("fingerprint,generated_at,summary,provider,model").order("generated_at",{ascending:false}).limit(1).maybeSingle();
    const changed=!last||last.fingerprint!==fingerprint;const stale=!last||Date.now()-new Date(last.generated_at).getTime()>4*3600000;
    let generated:any={summary:last?.summary||null,provider:last?.provider||null,model:last?.model||null,usage:null};
    if(changed||stale){generated=await narrative(promptR.data?.system_prompt||"Summarize the verified ResKonnect demand opportunities without inventing facts.",agentConfig?.config?.primary_model||"gpt-5.6-luna",ranked,sourceCounts);}
    const fallbackSummary=ranked.length?`Top demand-generation opportunity: ${ranked[0].campus_name} (priority ${ranked[0].campaign_priority}/100, ${ranked[0].available_spots} available spots). ${ranked.length} campus market(s) currently have reported available inventory.`:"No campus with reported available inventory is currently eligible for a demand campaign.";
    const inserted=await service.from("adminos_demand_snapshots").insert({days,fingerprint,supply,demand,institutions,housing_opportunities:housingOpps,ranked_opportunities:ranked,source_counts:sourceCounts,summary:generated.summary||fallbackSummary,provider:generated.provider||"deterministic",model:generated.model||"luna-demand-rg2",status:"completed",metadata:{release:RELEASE,phase:PHASE,changed,narrative_refreshed:Boolean(changed||stale)}}).select("id,generated_at,summary,ranked_opportunities,source_counts,provider,model").single();
    if(inserted.error)throw inserted.error;
    const snapshot=inserted.data;
    const automationEvents:any[]=[{event_type:"growth.demand_snapshot_created",entity_type:"demand_snapshot",entity_id:snapshot.id,payload:{days,top:ranked.slice(0,3),source_counts:sourceCounts},correlation_id:`luna:demand:${fingerprint}:${snapshot.id}`}];
    for(const item of ranked.slice(0,3).filter((x:any)=>x.campaign_priority>=55))automationEvents.push({event_type:"growth.opportunity_detected",entity_type:"demand_snapshot",entity_id:snapshot.id,payload:item,correlation_id:`luna:opportunity:${snapshot.id}:${item.campus_key}`});
    await service.from("adminos_automation_events").insert(automationEvents);
    if(runId)await service.from("adminos_agent_runs").update({status:"completed",output:{snapshot_id:snapshot.id,ranked:ranked.slice(0,8),source_counts:sourceCounts},completed_at:new Date().toISOString()}).eq("id",runId);
    if(runId&&generated.usage)await service.from("adminos_agent_usage").insert({run_id:runId,agent_key:"luna_demand",provider:"openai",model:generated.model||agentConfig?.config?.primary_model||"gpt-5.6-luna",input_tokens:Number(generated.usage.input_tokens||0),output_tokens:Number(generated.usage.output_tokens||0),estimated_cost_usd:costFor(generated.model||"gpt-5.6-luna",Number(generated.usage.input_tokens||0),Number(generated.usage.output_tokens||0)),latency_ms:Date.now()-started});
    return json({ok:true,identity:"luna_demand",release:RELEASE,phase:PHASE,snapshot_id:snapshot.id,generated_at:snapshot.generated_at,summary:snapshot.summary,ranked_opportunities:ranked.slice(0,12),source_counts:sourceCounts,narrative_refreshed:Boolean(changed||stale)});
  }catch(error){
    const detail=error instanceof Error?error.message:String(error);if(runId)await service.from("adminos_agent_runs").update({status:"failed",output:{error:detail},completed_at:new Date().toISOString()}).eq("id",runId);
    return json({error:"Luna demand cycle failed",detail,release:RELEASE,phase:PHASE},500);
  }
});
