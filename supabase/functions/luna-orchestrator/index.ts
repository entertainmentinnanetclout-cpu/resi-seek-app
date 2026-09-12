import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-luna-cron-token","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(name:string)=>Deno.env.get(name)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const openAIKey=env("OPENAI_API_KEY");
const RELEASE=2;
const PHASE=5;
const safe=(v:unknown,max=240)=>String(v??"").trim().slice(0,max);
const extractText=(data:any)=>{if(typeof data?.output_text==="string")return data.output_text;for(const item of data?.output||[])for(const part of item?.content||[])if(part?.type==="output_text"&&typeof part?.text==="string")return part.text;return "";};
const costFor=(model:string,input=0,output=0)=>{const rates:Record<string,[number,number]>={"gpt-5.6-luna":[.20,1.20],"gpt-5.6-terra":[2,12],"gpt-5.6-sol":[4,20]};const [ri,ro]=rates[model]||[0,0];return input/1e6*ri+output/1e6*ro;};
const secureEqual=(a:string,b:string)=>{if(!a||!b||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;};
const slug=(v:unknown)=>safe(v,180).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const scale=(n:number,mult=18)=>Math.min(100,Math.round(mult*Math.log1p(Math.max(0,n))));
const errorText=(error:unknown)=>error instanceof Error?error.message:(typeof error==="string"?error:JSON.stringify(error));

async function authorize(req:Request,service:any){
  const cron=req.headers.get("x-luna-cron-token")||"";
  if(cron){
    const {data}=await service.from("adminos_scheduler_secrets").select("secret_key,secret_value").in("secret_key",["luna_demand","luna_content"]);
    if((data||[]).some((row:any)=>secureEqual(cron,row.secret_value||"")))return{ok:true,actor:"scheduler",userId:null};
  }
  const authHeader=req.headers.get("Authorization")||"";
  if(!authHeader||!anonKey)return{ok:false,actor:null,userId:null};
  const auth=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
  const {data}=await auth.auth.getUser();const user=data?.user;
  if(!user)return{ok:false,actor:null,userId:null};
  const role=await service.rpc("get_user_staff_role",{_user_id:user.id});
  return{ok:Boolean(role.data),actor:role.data?"staff":null,userId:role.data?user.id:null};
}

async function hash(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}

const clampScore=(v:unknown)=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));
const jsonFromText=(text:string)=>{
  const clean=text.trim().replace(/^\`\`\`(?:json)?/i,"").replace(/\`\`\`$/,"").trim();
  try{return JSON.parse(clean);}catch{
    const first=clean.indexOf("{"),last=clean.lastIndexOf("}");
    if(first>=0&&last>first){try{return JSON.parse(clean.slice(first,last+1));}catch{/* fall through */}}
    return null;
  }
};
const hasUnsafeClaim=(value:unknown)=>{
  const text=JSON.stringify(value||{}).toLowerCase();
  return ["guaranteed placement","guarantee placement","first in africa","official partner","nsfas accredited","government partner","100% placement"].some(x=>text.includes(x));
};

async function contentDraft(prompt:string,model:string,facts:any,social:any[]){
  if(!openAIKey)return{draft:null,provider:null,model:null,usage:null};
  const schema={
    objective:"short string",audience:"short string",hook:"short string",offer:"short string",cta:"short string",
    content_format:"short string",quality_score:88,risk_level:"green",
    variants:{
      tiktok:{title:"",caption:"",asset_brief:"",hashtags:[]},
      instagram:{title:"",caption:"",asset_brief:"",hashtags:[]},
      facebook:{title:"",caption:"",asset_brief:"",hashtags:[]},
      youtube:{title:"",caption:"",asset_brief:"",hashtags:[]}
    }
  };
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${openAIKey}`,"Content-Type":"application/json"},body:JSON.stringify({
    model,
    input:[
      {role:"system",content:[{type:"input_text",text:prompt}]},
      {role:"user",content:[{type:"input_text",text:JSON.stringify({verified_facts:facts,social_demand:social,required_json_schema:schema})}]}
    ],
    max_output_tokens:1400
  })});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return{draft:null,provider:null,model:null,usage:null};
  return{draft:jsonFromText(extractText(data)),provider:"openai",model:data?.model||model,usage:data?.usage||null};
}

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


async function runContentCycle(service:any,authz:any,body:any){
  const started=Date.now();
  const academicYear=Math.max(2020,Math.min(2100,Number(body?.academic_year)||new Date().getFullYear()));
  const {data:config}=await service.from("adminos_agent_config").select("enabled,config").eq("agent_key","luna_content").maybeSingle();
  if(!config?.enabled)return json({error:"Luna Content Intelligence is disabled"},503);

  const run=await service.from("adminos_agent_runs").insert({
    agent_key:"luna_content",trigger_type:"content_cycle",status:"running",
    input:{academic_year:academicYear,source:safe(body?.source||authz.actor,80)},created_by:authz.userId
  }).select("id").single();
  const runId=run.data?.id||null;

  try{
    const [demandR,socialR,promptR]=await Promise.all([
      service.from("adminos_demand_snapshots")
        .select("id,academic_year,generated_at,ranked_opportunities,source_counts,summary")
        .eq("academic_year",academicYear).eq("status","completed").order("generated_at",{ascending:false}).limit(1).maybeSingle(),
      service.from("adminos_social_demand_snapshots")
        .select("id,network,period_start,period_end,metrics,top_content,best_times,demand_score,demand_signal,source,imported_at")
        .order("imported_at",{ascending:false}).limit(40),
      service.from("adminos_agent_prompt_versions")
        .select("system_prompt").eq("agent_key","luna_content").eq("active",true).order("version",{ascending:false}).limit(1).maybeSingle()
    ]);
    if(demandR.error)throw demandR.error;
    if(socialR.error)throw socialR.error;
    if(promptR.error)throw promptR.error;
    const demand=demandR.data;
    if(!demand?.id)throw new Error(`No completed Luna demand snapshot exists for academic year ${academicYear}`);

    const ranked=Array.isArray(demand.ranked_opportunities)?demand.ranked_opportunities:[];
    const opportunity=ranked.find((x:any)=>Number(x.available_spots||0)>0&&Number(x.campaign_priority||0)>=35);
    if(!opportunity){
      if(runId)await service.from("adminos_agent_runs").update({status:"completed",output:{skipped:true,reason:"no_eligible_inventory_backed_opportunity",academic_year:academicYear},completed_at:new Date().toISOString()}).eq("id",runId);
      return json({ok:true,skipped:true,reason:"No inventory-backed demand opportunity is eligible for content planning",academic_year:academicYear,release:RELEASE,phase:PHASE});
    }

    const socialLatest:any[]=[];const seen=new Set<string>();
    for(const row of socialR.data||[]){const network=String(row.network);if(seen.has(network))continue;seen.add(network);socialLatest.push(row);}
    socialLatest.sort((a,b)=>Number(b.demand_score||0)-Number(a.demand_score||0));

    const verifiedInventoryCount=Number(opportunity.verified_residence_count||0);
    const facts={
      academic_year:academicYear,
      demand_snapshot_id:demand.id,
      demand_generated_at:demand.generated_at,
      campus_key:opportunity.campus_key,
      campus_name:opportunity.campus_name,
      campaign_priority:Number(opportunity.campaign_priority||0),
      inventory_evidence:verifiedInventoryCount>0?"verified":"reported_internal_only",
      can_claim_exact_availability:verifiedInventoryCount>0,
      verified_available_spots:verifiedInventoryCount>0?Number(opportunity.verified_available_spots||0):null,
      verified_residence_count:verifiedInventoryCount,
      demand_index:Number(opportunity.demand_index||0),
      website_searches:Number(opportunity.website_searches||0),
      whatsapp_leads:Number(opportunity.whatsapp_leads||0),
      applications:Number(opportunity.applications||0),
      housing_signal:opportunity.housing_signal||null,
      target_path:`/find?campus=${encodeURIComponent(String(opportunity.campus_name||""))}`,
      public_claim_rule:"Do not state exact bed counts, prices, accreditation, guarantees or institutional endorsement unless explicitly verified in these public facts."
    };
    const socialForPrompt=socialLatest.map((x:any)=>({
      network:x.network,demand_score:Number(x.demand_score||0),demand_signal:x.demand_signal,
      metrics:x.metrics,best_times:x.best_times,period_start:x.period_start,period_end:x.period_end
    }));
    const fingerprint=await hash(JSON.stringify({facts,social:socialForPrompt.map((x:any)=>[x.network,x.demand_score,x.metrics])}));
    const planKey=`luna-content:${academicYear}:${fingerprint}`;
    const {data:existingPlan}=await service.from("adminos_content_plans").select("id,campaign_id,status,quality_score,platform_variants,created_at").eq("plan_key",planKey).maybeSingle();
    if(existingPlan&&!body?.force){
      if(runId)await service.from("adminos_agent_runs").update({status:"completed",output:{skipped:true,reason:"unchanged_fingerprint",content_plan_id:existingPlan.id},completed_at:new Date().toISOString()}).eq("id",runId);
      return json({ok:true,skipped:true,reason:"Content opportunity is unchanged",content_plan:existingPlan,academic_year:academicYear,release:RELEASE,phase:PHASE});
    }

    const generated=await contentDraft(
      promptR.data?.system_prompt||"Create fact-grounded, platform-specific ResKonnect social drafts. Never publish.",
      config?.config?.primary_model||"gpt-5.6-luna",facts,socialForPrompt
    );
    const fallback={
      objective:"Generate qualified student accommodation demand",
      audience:`Students seeking accommodation around ${opportunity.campus_name}`,
      hook:`${opportunity.campus_name}: verified accommodation options are currently available on ResKonnect.`,
      offer:"Compare available accommodation on ResKonnect using live listing information.",
      cta:"Open Find My Res and compare available options.",
      content_format:"vertical short-form video or residence carousel",
      quality_score:82,
      risk_level:"green",
      variants:{
        tiktok:{title:`${opportunity.campus_name} student accommodation`,caption:`Looking for student accommodation around ${opportunity.campus_name}? Check live options on ResKonnect and compare what is currently available.`,asset_brief:"Fast screen recording of Find My Res plus real residence media.",hashtags:["#StudentAccommodation","#ResKonnect"]},
        instagram:{title:`${opportunity.campus_name} accommodation`,caption:`Student accommodation around ${opportunity.campus_name}: explore current ResKonnect listings, compare options and continue through the verified application journey.`,asset_brief:"Premium residence carousel or Reel using real listing media.",hashtags:["#StudentLiving","#ResKonnect"]},
        facebook:{title:`Student accommodation near ${opportunity.campus_name}`,caption:`ResKonnect currently shows accommodation options serving ${opportunity.campus_name}. Students and parents can compare current listings and application information in Find My Res.`,asset_brief:"Clear explanatory graphic plus real residence imagery.",hashtags:["#StudentAccommodation","#ResKonnect"]},
        youtube:{title:`${opportunity.campus_name} Student Accommodation | ResKonnect`,caption:`Explore current student accommodation options serving ${opportunity.campus_name} through ResKonnect Find My Res.`,asset_brief:"Short vertical walkthrough using real listing/map footage.",hashtags:["#StudentAccommodation","#ResKonnect"]}
      }
    };
    const draft=generated.draft&&typeof generated.draft==="object"?generated.draft:fallback;
    let quality=clampScore(draft.quality_score||fallback.quality_score);
    let risk=["green","amber","red"].includes(String(draft.risk_level))?String(draft.risk_level):"green";
    const unsafe=hasUnsafeClaim(draft);
    if(unsafe){quality=Math.min(quality,70);risk="amber";}
    const status=quality>=85&&risk==="green"?"validated":"draft";
    const campusKey=slug(opportunity.campus_key||opportunity.campus_name).slice(0,12).toUpperCase()||"MARKET";
    const day=new Date().toISOString().slice(0,10).replaceAll("-","");
    const campaignCode=`RK-${day}-${campusKey}-${fingerprint.slice(0,6).toUpperCase()}`;

    let campaignId:string|null=null;
    const existingCampaign=await service.from("adminos_growth_campaigns").select("id,campaign_code").eq("source_signal_type","demand_snapshot").eq("source_signal_id",String(demand.id)).eq("campus",String(opportunity.campus_name||"")).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(existingCampaign.data?.id)campaignId=existingCampaign.data.id;
    else{
      const insertedCampaign=await service.from("adminos_growth_campaigns").insert({
        campaign_code:campaignCode,
        name:`${academicYear} ${opportunity.campus_name} demand pack`,
        objective:safe(draft.objective||fallback.objective,400),
        status:status==="validated"?"validated":"draft",
        source_signal_type:"demand_snapshot",source_signal_id:String(demand.id),
        campus:String(opportunity.campus_name||""),target_path:facts.target_path,
        audience:{description:safe(draft.audience||fallback.audience,600),academic_year:academicYear},
        strategy:{hook:safe(draft.hook||"",800),offer:safe(draft.offer||"",800),cta:safe(draft.cta||"",600),content_format:safe(draft.content_format||"",300),manual_publish:true},
        network_plan:{networks:socialLatest.map((x:any)=>x.network),metricool_role:"analysis_only",publishing:false},
        facts_snapshot:facts,risk_level:risk,quality_score:quality,created_by_agent:"luna_content",created_by_user:authz.userId
      }).select("id").single();
      if(insertedCampaign.error)throw insertedCampaign.error;
      campaignId=insertedCampaign.data.id;
    }

    const insertedPlan=await service.from("adminos_content_plans").insert({
      campaign_id:campaignId,plan_key:planKey,status,
      objective:safe(draft.objective||fallback.objective,1000),
      platform_variants:draft.variants||fallback.variants,
      facts_snapshot:{...facts,social_demand:socialForPrompt},
      validation:{unsafe_claim_detected:unsafe,manual_publish_required:true,metricool_publishing:false,quality_threshold:85},
      risk_level:risk,quality_score:quality,generated_by:"luna_content"
    }).select("id,status,quality_score,platform_variants,created_at").single();
    if(insertedPlan.error)throw insertedPlan.error;

    const contentPlanId=insertedPlan.data.id;
    const variants=draft.variants||fallback.variants;
    const networks=["tiktok","instagram","facebook","youtube"].filter(network=>variants?.[network]);
    const socialByNetwork=new Map(socialLatest.map((x:any)=>[String(x.network),x]));
    const posts=networks.map(network=>{
      const variant=variants[network]||{};
      const social:any=socialByNetwork.get(network);
      const targetUrl=`https://www.reskonnect.org${facts.target_path}${facts.target_path.includes("?")?"&":"?"}rk_campaign=${encodeURIComponent(campaignCode)}&utm_source=${network}&utm_medium=social&utm_campaign=${encodeURIComponent(campaignCode)}`;
      return{
        campaign_id:campaignId,content_plan_id:contentPlanId,network,status,
        title:safe(variant.title||"",300),caption:safe(variant.caption||"",5000),
        payload:{asset_brief:safe(variant.asset_brief||"",1200),hashtags:Array.isArray(variant.hashtags)?variant.hashtags.slice(0,20):[],target_url:targetUrl,academic_year:academicYear,metricool_demand_score:Number(social?.demand_score||0),metricool_demand_signal:social?.demand_signal||"unknown"},
        provider:"manual",manual_publish_required:true,demand_snapshot_id:social?.id||null,
        posting_notes:"Prepared by Luna. Founder/manual posting required. Metricool is analysis-only."
      };
    });
    if(posts.length){const postInsert=await service.from("adminos_social_posts").insert(posts);if(postInsert.error)throw postInsert.error;}

    const eventType=status==="validated"?"growth.content_pack_ready":"growth.content_pack_draft";
    await service.from("adminos_automation_events").insert({
      event_type:eventType,entity_type:"content_plan",entity_id:contentPlanId,
      payload:{campaign_id:campaignId,campaign_code:campaignCode,academic_year:academicYear,campus:opportunity.campus_name,quality_score:quality,risk_level:risk,manual_publish_required:true,networks},
      correlation_id:`luna:content:${contentPlanId}`
    });

    if(runId)await service.from("adminos_agent_runs").update({status:"completed",output:{campaign_id:campaignId,content_plan_id:contentPlanId,campaign_code:campaignCode,quality_score:quality,risk_level:risk,manual_publish_required:true,networks},completed_at:new Date().toISOString()}).eq("id",runId);
    if(runId&&generated.usage)await service.from("adminos_agent_usage").insert({
      run_id:runId,agent_key:"luna_content",provider:"openai",model:generated.model||config?.config?.primary_model||"gpt-5.6-luna",
      input_tokens:Number(generated.usage.input_tokens||0),output_tokens:Number(generated.usage.output_tokens||0),
      estimated_cost_usd:costFor(generated.model||"gpt-5.6-luna",Number(generated.usage.input_tokens||0),Number(generated.usage.output_tokens||0)),
      latency_ms:Date.now()-started
    });

    return json({ok:true,identity:"luna_content",release:RELEASE,phase:PHASE,academic_year:academicYear,campaign_id:campaignId,content_plan_id:contentPlanId,campaign_code:campaignCode,status,quality_score:quality,risk_level:risk,manual_publish_required:true,metricool_publishing:false,networks});
  }catch(error){
    const detail=errorText(error);
    if(runId)await service.from("adminos_agent_runs").update({status:"failed",output:{error:detail},completed_at:new Date().toISOString()}).eq("id",runId);
    return json({error:"Luna content cycle failed",detail,release:RELEASE,phase:PHASE},500);
  }
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!supabaseUrl||!serviceKey)return json({error:"Supabase runtime is not configured"},500);
  const service=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const authz=await authorize(req,service);if(!authz.ok)return json({error:"Unauthorized"},401);
  const body=await req.json().catch(()=>({}));const action=safe(body?.action||"health",80);
  const days=[7,30,90].includes(Number(body?.days))?Number(body.days):30;
  const academicYear=Math.max(2020,Math.min(2100,Number(body?.academic_year)||new Date().getFullYear()));
  const agentKey=action==="content_cycle"||action==="latest_content"?"luna_content":"luna_demand";
  const {data:agentConfig}=await service.from("adminos_agent_config").select("enabled,config").eq("agent_key",agentKey).maybeSingle();
  if(!agentConfig?.enabled)return json({error:`${agentKey} is disabled`},503);
  if(action==="health"){
    const [latestDemand,latestContent,social]=await Promise.all([
      service.from("adminos_demand_snapshots").select("id,academic_year,generated_at,status,source_counts").eq("academic_year",academicYear).order("generated_at",{ascending:false}).limit(1).maybeSingle(),
      service.from("adminos_content_plans").select("id,status,quality_score,created_at").order("created_at",{ascending:false}).limit(1).maybeSingle(),
      service.from("adminos_social_demand_snapshots").select("network,demand_score,demand_signal,imported_at").order("imported_at",{ascending:false}).limit(8)
    ]);
    return json({ok:true,identity:"luna_orchestrator",release:RELEASE,phase:PHASE,academic_year:academicYear,latest_demand:latestDemand.data||null,latest_content:latestContent.data||null,social_demand:social.data||[],publishing:false,manual_publish_required:true});
  }
  if(action==="latest"){
    const {data:latest}=await service.from("adminos_demand_snapshots").select("*").eq("academic_year",academicYear).order("generated_at",{ascending:false}).limit(1).maybeSingle();
    return json({ok:true,latest:latest||null,academic_year:academicYear,release:RELEASE,phase:PHASE});
  }
  if(action==="latest_content"){
    const {data:latest}=await service.from("adminos_content_plans").select("*,adminos_growth_campaigns(campaign_code,name,campus,target_path)").order("created_at",{ascending:false}).limit(1).maybeSingle();
    return json({ok:true,latest:latest||null,release:RELEASE,phase:PHASE,publishing:false});
  }
  if(action==="content_cycle")return await runContentCycle(service,authz,{...body,academic_year:academicYear});
  if(action!=="demand_cycle")return json({error:"Unsupported action"},400);

  const run=await service.from("adminos_agent_runs").insert({agent_key:"luna_demand",trigger_type:"demand_cycle",status:"running",input:{days,source:safe(body?.source||authz.actor,80)},created_by:authz.userId}).select("id").single();
  const runId=run.data?.id||null;const started=Date.now();
  try{
    const since=new Date(Date.now()-days*86400000).toISOString();
    const [supplyR,demandR,institutionR,campusR,waR,appR,promptR]=await Promise.all([
      service.rpc("luna_academic_supply_live",{p_academic_year:academicYear}),
      service.rpc("luna_academic_demand_heat",{p_academic_year:academicYear,p_days:days}),
      service.rpc("housing_intel_institution_snapshot",{p_days:days}),
      service.from("resmap_campuses").select("campus_key,name,short_name,aliases").eq("is_active",true),
      service.from("adminos_whatsapp_conversion_leads").select("campus,stage,created_at,converted_at,academic_year").eq("academic_year",academicYear).gte("created_at",since).limit(5000),
      service.from("applications").select("id,status,created_at,residence_id,academic_year,residences!applications_residence_id_fkey(campus)").eq("academic_year",academicYear).gte("created_at",since).limit(5000),
      service.from("adminos_agent_prompt_versions").select("system_prompt").eq("agent_key","luna_demand").eq("active",true).order("version",{ascending:false}).limit(1).maybeSingle(),
    ]);
    const sourceErrors={supply:supplyR.error,demand:demandR.error,institutions:institutionR.error,campuses:campusR.error,whatsapp:waR.error,applications:appR.error,prompt:promptR.error};
    const failed=Object.entries(sourceErrors).find(([,value])=>Boolean(value));
    if(failed)throw new Error(`${failed[0]} source failed: ${errorText(failed[1])}`);
    const supply=supplyR.data||[], demand=demandR.data||[], institutions=institutionR.data||[];
    const resolve=campusResolver(campusR.data||[]);
    const demandMap=new Map(demand.map((x:any)=>[String(x.campus_key),x]));
    const waMap=new Map<string,{leads:number,converted:number}>();for(const w of waR.data||[]){const key=resolve(w.campus);const p=waMap.get(key)||{leads:0,converted:0};p.leads++;if(w.converted_at||["converted","placed","applied"].includes(String(w.stage||"").toLowerCase()))p.converted++;waMap.set(key,p);}
    const appMap=new Map<string,number>();for(const a of appR.data||[]){const relation=Array.isArray(a.residences)?a.residences[0]:a.residences;const key=resolve(relation?.campus);appMap.set(key,(appMap.get(key)||0)+1);}
    const ranked=supply.filter((s:any)=>Number(s.available_spots||0)>0).map((s:any)=>{
      const key=String(s.campus_key||resolve(s.campus_name));const d=demandMap.get(key)||{};const w=waMap.get(key)||{leads:0,converted:0};const apps=appMap.get(key)||0;
      const demandScore=Number(d.demand_index||0);const availabilityRate=Number(s.availability_rate||0);const vacancyScore=Math.min(100,Math.round(scale(Number(s.available_spots||0),14)*.65+Math.min(100,availabilityRate*1.5)*.35));const scopedSearches=Number(d.scoped_search_signals||0);const searchScore=scale(scopedSearches,20);const whatsappScore=scale(w.leads,22);const applicationScore=scale(apps,18);
      const campaignPriority=Math.round(demandScore*.40+vacancyScore*.30+searchScore*.10+whatsappScore*.10+applicationScore*.10);
      return{academic_year:academicYear,campus_key:key,campus_name:s.campus_name,campaign_priority:campaignPriority,available_spots:Number(s.available_spots||0),verified_available_spots:Number(s.verified_available_spots||0),total_capacity:Number(s.total_capacity||0),reported_residence_count:Number(s.reported_residence_count||0),verified_residence_count:Number(s.verified_residence_count||0),availability_rate:availabilityRate,average_price:s.average_price==null?null:Number(s.average_price),demand_index:demandScore,demand_count:Number(d.demand_count||0),search_signals:scopedSearches,website_searches:scopedSearches,website_unique_visitors:0,whatsapp_leads:w.leads,whatsapp_converted:w.converted,applications:apps,housing_opportunity_score:campaignPriority,housing_signal:campaignPriority>=70?"strong":campaignPriority>=50?"rising":"monitor",reason:campaignPriority>=70?"high-priority year-scoped demand generation":campaignPriority>=50?"rising year-scoped growth opportunity":"monitor"};
    }).sort((a:any,b:any)=>b.campaign_priority-a.campaign_priority||b.available_spots-a.available_spots);
    const sourceCounts={academic_year:academicYear,housing_supply_campuses:supply.length,housing_demand_campuses:demand.length,scoped_search_signals:demand.reduce((sum:number,row:any)=>sum+Number(row.scoped_search_signals||0),0),whatsapp_leads:(waR.data||[]).length,applications:(appR.data||[]).length,ranked_campuses:ranked.length};
    const fingerprint=await hash(JSON.stringify([academicYear,...ranked.slice(0,8).map((x:any)=>[x.campus_key,x.campaign_priority,x.available_spots,x.demand_count,x.website_searches,x.whatsapp_leads,x.applications])]));
    const {data:last}=await service.from("adminos_demand_snapshots").select("fingerprint,generated_at,summary,provider,model").eq("academic_year",academicYear).order("generated_at",{ascending:false}).limit(1).maybeSingle();
    const changed=!last||last.fingerprint!==fingerprint;const stale=!last||Date.now()-new Date(last.generated_at).getTime()>4*3600000;
    let generated:any={summary:last?.summary||null,provider:last?.provider||null,model:last?.model||null,usage:null};
    if(changed||stale){generated=await narrative(promptR.data?.system_prompt||"Summarize the verified ResKonnect demand opportunities without inventing facts.",agentConfig?.config?.primary_model||"gpt-5.6-luna",ranked,sourceCounts);}
    const fallbackSummary=ranked.length?`Top demand-generation opportunity: ${ranked[0].campus_name} (priority ${ranked[0].campaign_priority}/100, ${ranked[0].available_spots} available spots). ${ranked.length} campus market(s) currently have reported available inventory.`:"No campus with reported available inventory is currently eligible for a demand campaign.";
    const inserted=await service.from("adminos_demand_snapshots").insert({academic_year:academicYear,days,fingerprint,supply,demand,institutions,housing_opportunities:[],ranked_opportunities:ranked,source_counts:sourceCounts,summary:generated.summary||fallbackSummary,provider:generated.provider||"deterministic",model:generated.model||"luna-demand-rg2",status:"completed",metadata:{release:RELEASE,phase:PHASE,changed,narrative_refreshed:Boolean(changed||stale),academic_year:academicYear,year_scoped:true}}).select("id,academic_year,generated_at,summary,ranked_opportunities,source_counts,provider,model").single();
    if(inserted.error)throw inserted.error;
    const snapshot=inserted.data;
    const automationEvents:any[]=[{event_type:"growth.demand_snapshot_created",entity_type:"demand_snapshot",entity_id:snapshot.id,payload:{academic_year:academicYear,days,top:ranked.slice(0,3),source_counts:sourceCounts},correlation_id:`luna:demand:${academicYear}:${fingerprint}:${snapshot.id}`}];
    for(const item of ranked.slice(0,3).filter((x:any)=>x.campaign_priority>=55))automationEvents.push({event_type:"growth.opportunity_detected",entity_type:"demand_snapshot",entity_id:snapshot.id,payload:item,correlation_id:`luna:opportunity:${snapshot.id}:${item.campus_key}`});
    const eventInsert=await service.from("adminos_automation_events").insert(automationEvents);if(eventInsert.error)throw new Error(`automation event insert failed: ${errorText(eventInsert.error)}`);
    if(runId)await service.from("adminos_agent_runs").update({status:"completed",output:{snapshot_id:snapshot.id,ranked:ranked.slice(0,8),source_counts:sourceCounts},completed_at:new Date().toISOString()}).eq("id",runId);
    if(runId&&generated.usage)await service.from("adminos_agent_usage").insert({run_id:runId,agent_key:"luna_demand",provider:"openai",model:generated.model||agentConfig?.config?.primary_model||"gpt-5.6-luna",input_tokens:Number(generated.usage.input_tokens||0),output_tokens:Number(generated.usage.output_tokens||0),estimated_cost_usd:costFor(generated.model||"gpt-5.6-luna",Number(generated.usage.input_tokens||0),Number(generated.usage.output_tokens||0)),latency_ms:Date.now()-started});
    return json({ok:true,identity:"luna_demand",release:RELEASE,phase:PHASE,academic_year:academicYear,snapshot_id:snapshot.id,generated_at:snapshot.generated_at,summary:snapshot.summary,ranked_opportunities:ranked.slice(0,12),source_counts:sourceCounts,narrative_refreshed:Boolean(changed||stale)});
  }catch(error){
    const detail=errorText(error);if(runId)await service.from("adminos_agent_runs").update({status:"failed",output:{error:detail},completed_at:new Date().toISOString()}).eq("id",runId);
    return json({error:"Luna demand cycle failed",detail,release:RELEASE,phase:PHASE},500);
  }
});