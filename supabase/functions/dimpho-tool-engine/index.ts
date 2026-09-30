import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-dimpho-internal","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
const env=(n:string)=>Deno.env.get(n)||"";
const supabaseUrl=env("SUPABASE_URL")||env("EXTERNAL_SUPABASE_URL");
const serviceKey=env("SUPABASE_SERVICE_ROLE_KEY")||env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey=env("SUPABASE_ANON_KEY")||env("EXTERNAL_SUPABASE_ANON_KEY");
const twilioAccountSid=env("TWILIO_ACCOUNT_SID");
const twilioAuthToken=env("TWILIO_AUTH_TOKEN");
const twilioWhatsappFrom=env("TWILIO_WHATSAPP_FROM");
const PUBLIC_BASE="https://www.reskonnect.org";
const service=supabaseUrl&&serviceKey?createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const safeText=(v:any,max=160)=>String(v??"").trim().slice(0,max);
const norm=(v:any)=>String(v??"").toLowerCase().replace(/[()]/g," ").replace(/\s+/g," ").trim();
const phoneDigits=(v:any)=>String(v??"").replace(/^whatsapp:/i,"").replace(/\D/g,"");
const e164=(v:any)=>{let d=phoneDigits(v);if(d.startsWith("0")&&d.length===10)d="27"+d.slice(1);if(!d.startsWith("27")&&d.length===9)d="27"+d;return d?"+"+d:"";};
const wa=(v:any)=>{const n=e164(v);return n?"whatsapp:"+n:"";};
const twilioBasic=()=>`Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`;

async function notifyOwnerEscalation(threadId:string,reason:string,contactId:string|null=null,fallbackPhone:string|null=null){
  try{
    if(!threadId||!service)return{sent:false,reason:"missing_thread"};
    const prior=await service.from("adminos_automation_events").select("id").eq("event_type","whatsapp.owner_escalation_notified").eq("entity_type","whatsapp_thread").eq("entity_id",threadId).limit(1).maybeSingle();
    if(prior.data)return{sent:false,deduplicated:true};
    const cfg=(await service.from("rk_brain_config").select("config").eq("config_key","core").maybeSingle()).data?.config||{};
    if(cfg.escalation_alert_enabled!==true)return{sent:false,reason:"disabled"};
    const alertTo=e164(cfg.escalation_alert_to||"");
    if(!alertTo||!twilioAccountSid||!twilioAuthToken||!twilioWhatsappFrom)return{sent:false,reason:"notification_transport_not_configured"};
    const thread=(await service.from("adminos_whatsapp_threads").select("id,contact_id,channel_address,intent,priority").eq("id",threadId).maybeSingle()).data||null;
    const resolvedContactId=contactId||thread?.contact_id||null;
    const contact=resolvedContactId?(await service.from("adminos_contacts").select("full_name,phone,campus").eq("id",resolvedContactId).maybeSingle()).data:null;
    const customerPhone=e164(contact?.phone||thread?.channel_address||fallbackPhone||"");
    const lines=[
      "🚨 DIMPHO ESCALATION",
      contact?.full_name?`Customer: ${safeText(contact.full_name,120)}`:null,
      customerPhone?`WhatsApp: ${customerPhone}`:null,
      contact?.campus?`Campus: ${safeText(contact.campus,120)}`:null,
      thread?.intent?`Intent: ${safeText(thread.intent,80)}`:null,
      `Reason: ${safeText(reason,500)}`,
      `Thread: ${threadId}`,
      "Action: Open AdminOS → WhatsApp Desk"
    ].filter(Boolean).join("\n");
    const form=new URLSearchParams({From:wa(twilioWhatsappFrom),To:wa(alertTo),Body:lines.slice(0,3000)});
    const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,{method:"POST",headers:{Authorization:twilioBasic(),"Content-Type":"application/x-www-form-urlencoded"},body:form});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.message||`Twilio HTTP ${response.status}`);
    await service.from("adminos_automation_events").insert({event_type:"whatsapp.owner_escalation_notified",entity_type:"whatsapp_thread",entity_id:threadId,contact_id:resolvedContactId,payload:{reason,twilio_message_sid:data.sid||null,channel:"whatsapp_twilio",persona:"Dimpho"}});
    return{sent:true,sid:data.sid||null};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    try{await service?.from("adminos_automation_events").insert({event_type:"whatsapp.owner_escalation_notification_failed",entity_type:"whatsapp_thread",entity_id:threadId,contact_id:contactId,payload:{reason,error:message,persona:"Dimpho"}});}catch{}
    return{sent:false,error:message};
  }
}
const campusProvince=(v:any)=>{const x=norm(v);if(/polokwane|giyani/.test(x))return"Limpopo";if(/mbombela|nelspruit|emalahleni|witbank/.test(x))return"Mpumalanga";if(/pretoria|arcadia|arts campus|soshanguve|ga-rankuwa|garankuwa/.test(x))return"Gauteng";return null;};
const campusList=(v:any)=>String(v||"").replace(/\s+and\s+/gi,",").split(/[,;|/]+/).map((x)=>x.trim()).filter(Boolean);
const isSosha=(r:any)=>Array.isArray(r?.institution_tags)&&r.institution_tags.some((x:any)=>{const v=norm(x);return v.includes("sosha")||v.includes("tosha");});
const isEkhaya=(r:any)=>norm(r?.name).includes("ekhaya junction");
function eligibleCampuses(r:any){
  const province=norm(r?.province),list=campusList(r?.campus);
  const same=list.filter((campus)=>{const p=campusProvince(campus);return !province||!p||norm(p)===province;});
  const pretoriaWest=same.some((x)=>norm(x).includes("pretoria west"))||norm([r?.address,r?.city].filter(Boolean).join(" ")).includes("pretoria west");
  return same.filter((campus)=>!(pretoriaWest&&norm(campus).includes("soshanguve")&&!isEkhaya(r)&&!isSosha(r)));
}
function matchesRequestedCampus(r:any,requested:string){
  if(!requested)return true;
  const requestedProvince=campusProvince(requested);
  if(requestedProvince&&r?.province&&norm(requestedProvince)!==norm(r.province))return false;
  const needles=[norm(requested)];
  if(norm(requested).includes("soshanguve"))needles.push("soshanguve");
  if(norm(requested).includes("pretoria west"))needles.push("pretoria west");
  return eligibleCampuses(r).some((campus)=>needles.some((needle)=>norm(campus).includes(needle)||needle.includes(norm(campus))));
}

async function caller(req:Request,body:any){
  const internal=(req.headers.get("x-dimpho-internal")===serviceKey||req.headers.get("x-rk-brain-internal")===serviceKey)&&Boolean(serviceKey);
  if(internal)return{internal:true,userId:body.caller_user_id?safeText(body.caller_user_id,64):null,staff:true,role:"agent"};
  const auth=req.headers.get("Authorization")||"";
  const client=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data}=await client.auth.getUser();
  const user=data?.user||null; let staff=false;
  if(user){try{const r=await service!.rpc("get_user_staff_role",{_user_id:user.id});staff=Boolean(r.data);}catch{/* no-op */}}
  return{internal:false,userId:user?.id||null,staff,role:staff?"staff":"user"};
}

function normalizePublication(data:any){
  if(!data)return null;
  const snapshot=data.snapshot||{}; const scenes=Array.isArray(snapshot.scenes)?snapshot.scenes:[];
  return{tour_id:data.tour_id,residence_id:data.residence_id||null,workspace:snapshot.workspace||{type:snapshot?.tour?.workspace_type||"residence",label:snapshot?.tour?.title||"360 View"},tour:snapshot.tour||{},public_token:data.public_token,version_number:data.version_number||data.version_no,published_at:data.published_at,valid_until:data.valid_until,url:`${PUBLIC_BASE}/tour/${data.public_token}`,scene_count:scenes.length,scenes:scenes.map((s:any)=>({id:s.id,name:s.name,area_type:s.area_type,floor_label:s.floor_label||null,room_label:s.room_label||null,quality_score:Number(s.quality_score||0),is_start:Boolean(s.is_start),panorama_url:s.panorama_url||null})).slice(0,120)};
}
async function publishedTourForResidence(residenceId:string){
  const now=new Date().toISOString();
  const {data,error}=await service!.from("virtual_tour_publications").select("tour_id,residence_id,version_no,version_number,public_token,snapshot,published_at,valid_until,status").eq("residence_id",residenceId).eq("status","published").or(`valid_until.is.null,valid_until.gt.${now}`).order("published_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw error; return normalizePublication(data);
}
async function publishedTourByToken(token:string){
  const now=new Date().toISOString();
  const {data,error}=await service!.from("virtual_tour_publications").select("tour_id,residence_id,version_no,version_number,public_token,snapshot,published_at,valid_until,status").eq("public_token",token).eq("status","published").or(`valid_until.is.null,valid_until.gt.${now}`).order("published_at",{ascending:false}).limit(1).maybeSingle();
  if(error)throw error; return normalizePublication(data);
}

async function executeTool(toolKey:string,args:any,contextUserId:string|null,contactId:string|null,threadRef:string|null){
  const a=args&&typeof args==="object"?args:{};
  if(toolKey==="get_customer_profile"){
    if(!contextUserId)throw new Error("Authenticated customer context required");
    const {data,error}=await service!.from("profiles").select("id,full_name,email,campus,course,year_of_study,phone,applicant_stage,updated_at").eq("id",contextUserId).maybeSingle(); if(error)throw error; return{profile:data};
  }
  if(toolKey==="get_application_status"){
    if(!contextUserId)throw new Error("Authenticated customer context required");
    let q=service!.from("applications").select("id,status,funding_type,created_at,updated_at,residence_id,residences(name,slug,campus,price,available_spots)").eq("user_id",contextUserId).order("updated_at",{ascending:false}).limit(8); const id=safeText(a.application_id,64);if(id)q=q.eq("id",id); const {data,error}=await q;if(error)throw error;return{applications:data||[]};
  }
  if(toolKey==="get_application_requirements"){
    if(!contextUserId)throw new Error("Authenticated customer context required");
    const flow=safeText(a.flow_key,80)||"accommodation"; const {data:requirements,error}=await service!.from("document_requirements").select("document_key,label,description,is_required,sort_order,metadata").eq("flow_key",flow).eq("active",true).order("sort_order"); if(error)throw error;
    let documents:any[]=[];const appId=safeText(a.application_id,64); if(appId){const own=await service!.from("applications").select("id").eq("id",appId).eq("user_id",contextUserId).maybeSingle();if(own.data){const docs=await service!.from("application_documents").select("doc_type,status,rejection_reason,uploaded_at,verified_at").eq("application_id",appId);documents=docs.data||[];}} return{flow_key:flow,requirements:requirements||[],submitted_documents:documents};
  }
  if(toolKey==="find_residences"){
    const limit=clamp(Number(a.limit||8)||8,1,20); let q=service!.from("residences").select("id,name,slug,campus,address,canonical_address,city,canonical_city,place_label,province,canonical_province,institution_tags,price,private_price,nsfas_price,available_spots,room_type,room_types,accepts_nsfas,accepts_private,accepts_tvet,accepts_university,is_tut_accredited,has_wifi,is_furnished,distance_from_campus,verification_level,cover_image_url,image_url,images,amenities,latitude,longitude,google_maps_url,virtual_tour_url").eq("is_visible",true).eq("map_hidden",false).order("available_spots",{ascending:false}).limit(Math.min(80,Math.max(limit*5,30)));
    const campus=safeText(a.campus,120);if(a.max_price!==undefined&&Number.isFinite(Number(a.max_price)))q=q.lte("price",Number(a.max_price)); if(a.nsfas===true)q=q.eq("accepts_nsfas",true); const room=safeText(a.room_type,80);if(room)q=q.ilike("room_type",`%${room}%`); const {data,error}=await q;if(error)throw error;
    const rows=(data||[]).filter((r:any)=>matchesRequestedCampus(r,campus)).slice(0,limit); const tours=await Promise.all(rows.map((r:any)=>publishedTourForResidence(r.id).catch(()=>null))); return{residences:rows.map((r:any,index:number)=>{const destination=r.slug?`${PUBLIC_BASE}/find-my-res/${encodeURIComponent(r.slug)}`:PUBLIC_BASE+"/find";const images=[r.cover_image_url,r.image_url,...(Array.isArray(r.images)?r.images:[])].filter(Boolean).filter((value:string,pos:number,all:string[])=>all.indexOf(value)===pos);const locationUrl=r.google_maps_url||(r.latitude!=null&&r.longitude!=null?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(r.latitude)+","+String(r.longitude))}`:null);const published=tours[index];const fallbackTour=!published&&r.virtual_tour_url?{available:true,url:r.virtual_tour_url,source:"residence_record"}:null;return{...r,province:r.canonical_province||r.province,city:r.canonical_city||r.city,address:r.canonical_address||r.address,physical_location:r.place_label||r.canonical_city||r.city,served_campuses:eligibleCampuses(r),image_url:images[0]||null,images,location_url:locationUrl,url:destination,application_url:destination,view_apply_url:destination,virtual_tour:published?{available:true,url:published.url,scene_count:published.scene_count,published_at:published.published_at}:fallbackTour};})};
  }
  if(toolKey==="get_residence_details"){
    const id=safeText(a.residence_id,64),slug=safeText(a.slug,180);if(!id&&!slug)throw new Error("residence_id or slug required"); let q=service!.from("residences").select("id,name,slug,address,canonical_address,campus,city,canonical_city,place_label,province,canonical_province,institution_tags,description,price,private_price,nsfas_price,available_spots,capacity,room_type,room_types,amenities,accepts_nsfas,accepts_private,accepts_tvet,accepts_university,is_tut_accredited,has_wifi,is_furnished,has_parking,utilities_included,distance_from_campus,verification_level,location_verification_status,cover_image_url,image_url,images,latitude,longitude,google_maps_url,virtual_tour_url,whatsapp_phone").eq("is_visible",true).eq("map_hidden",false); q=id?q.eq("id",id):q.eq("slug",slug); const {data,error}=await q.maybeSingle();if(error)throw error; const vt=data?await publishedTourForResidence(data.id).catch(()=>null):null; if(!data)return{residence:null};const destination=data.slug?`${PUBLIC_BASE}/find-my-res/${encodeURIComponent(data.slug)}`:PUBLIC_BASE+"/find";const images=[data.cover_image_url,data.image_url,...(Array.isArray(data.images)?data.images:[])].filter(Boolean).filter((value:string,pos:number,all:string[])=>all.indexOf(value)===pos);const locationUrl=data.google_maps_url||(data.latitude!=null&&data.longitude!=null?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(data.latitude)+","+String(data.longitude))}`:null);const fallbackTour=!vt&&data.virtual_tour_url?{available:true,url:data.virtual_tour_url,source:"residence_record"}:null;return{residence:{...data,province:data.canonical_province||data.province,city:data.canonical_city||data.city,address:data.canonical_address||data.address,physical_location:data.place_label||data.canonical_city||data.city,served_campuses:eligibleCampuses(data),image_url:images[0]||null,images,location_url:locationUrl,url:destination,application_url:destination,view_apply_url:destination,virtual_tour:vt?{available:true,url:vt.url,scene_count:vt.scene_count,published_at:vt.published_at}:fallbackTour}};
  }
  if(toolKey==="get_virtual_tour"){
    const token=safeText(a.public_token,64);
    if(token){
      const vt=await publishedTourByToken(token); if(!vt)return{workspace:null,residence:null,virtual_tour:null};
      let residence:any=null; if(vt.residence_id){const r=await service!.from("residences").select("id,name,slug,campus,address").eq("id",vt.residence_id).maybeSingle();if(r.error)throw r.error;residence=r.data?{...r.data,url:r.data.slug?`${PUBLIC_BASE}/find-my-res/${encodeURIComponent(r.data.slug)}`:PUBLIC_BASE+"/find"}:null;}
      return{workspace:vt.workspace,residence,virtual_tour:{available:true,url:vt.url,public_token:vt.public_token,scene_count:vt.scene_count,published_at:vt.published_at,valid_until:vt.valid_until,title:vt.tour?.title||vt.workspace?.label,scenes:vt.scenes.map((s:any)=>({id:s.id,name:s.name,area_type:s.area_type,floor_label:s.floor_label,quality_score:s.quality_score,is_start:s.is_start}))}};
    }
    const id=safeText(a.residence_id,64),slug=safeText(a.slug,180);if(!id&&!slug)throw new Error("public_token, residence_id or slug required"); let q=service!.from("residences").select("id,name,slug,campus,address,is_visible,map_hidden").eq("is_visible",true).eq("map_hidden",false); q=id?q.eq("id",id):q.eq("slug",slug); const {data:residence,error}=await q.maybeSingle();if(error)throw error;if(!residence)return{workspace:null,residence:null,virtual_tour:null}; const vt=await publishedTourForResidence(residence.id); return{workspace:vt?.workspace||{type:"residence",label:residence.name},residence:{id:residence.id,name:residence.name,slug:residence.slug,campus:residence.campus,address:residence.address,url:residence.slug?`${PUBLIC_BASE}/find-my-res/${encodeURIComponent(residence.slug)}`:PUBLIC_BASE+"/find"},virtual_tour:vt?{available:true,url:vt.url,public_token:vt.public_token,scene_count:vt.scene_count,published_at:vt.published_at,valid_until:vt.valid_until,scenes:vt.scenes.map((s:any)=>({id:s.id,name:s.name,area_type:s.area_type,floor_label:s.floor_label,quality_score:s.quality_score,is_start:s.is_start}))}:null};
  }
  if(toolKey==="get_virtual_tour_scene"){
    const token=safeText(a.public_token,64);if(!token)throw new Error("public_token required"); const vt=await publishedTourByToken(token);if(!vt)return{workspace:null,scene:null,scenes:[]}; const wantedName=safeText(a.scene_name,120).toLowerCase(),wantedArea=safeText(a.area_type,60).toLowerCase(); const matches=vt.scenes.filter((s:any)=>(!wantedName||String(s.name||"").toLowerCase().includes(wantedName))&&(!wantedArea||String(s.area_type||"").toLowerCase()===wantedArea)); return{workspace:vt.workspace,tour_url:vt.url,published_at:vt.published_at,scenes:matches.slice(0,12)};
  }
  if(toolKey==="get_opportunities"){
    const limit=clamp(Number(a.limit||8)||8,1,20); let q=service!.from("public_opportunities").select("id,slug,title,opportunity_type,organisation,location,province,description,requirements,application_url,closing_date,date_posted,employment_type,last_verified_at").eq("is_published",true).or(`closing_date.is.null,closing_date.gte.${new Date().toISOString()}`).order("date_posted",{ascending:false}).limit(limit); const type=safeText(a.type,80),province=safeText(a.province,80);if(type)q=q.ilike("opportunity_type",`%${type}%`);if(province)q=q.ilike("province",`%${province}%`); const {data,error}=await q;if(error)throw error;return{opportunities:data||[]};
  }
  if(toolKey==="get_referral_status"){
    if(!contextUserId)throw new Error("Authenticated customer context required"); const [codes,earnings]=await Promise.all([service!.from("referral_codes").select("code,is_active,signup_count,sale_count,total_earned,total_paid,program_key,created_at").eq("user_id",contextUserId).order("created_at",{ascending:false}).limit(10),service!.from("referral_earnings").select("amount,status,source_type,paid_at,created_at").eq("referrer_user_id",contextUserId).order("created_at",{ascending:false}).limit(100)]); if(codes.error)throw codes.error;if(earnings.error)throw earnings.error; const rows=earnings.data||[]; return{codes:codes.data||[],earnings:{total:rows.reduce((s:number,x:any)=>s+Number(x.amount||0),0),paid:rows.filter((x:any)=>x.status==="paid").reduce((s:number,x:any)=>s+Number(x.amount||0),0),items:rows.slice(0,20)}};
  }
  if(toolKey==="request_human_support"){
    if(!contextUserId&&!contactId)throw new Error("Customer context required"); const reason=safeText(a.reason,500)||"Customer requested human support";let updated=false; const candidate=safeText(a.thread_id,64)||threadRef||""; if(candidate){const t=await service!.from("adminos_whatsapp_threads").select("id,contact_id,channel_address").eq("id",candidate).maybeSingle();if(t.data&&(!contactId||t.data.contact_id===contactId)){await service!.from("adminos_whatsapp_threads").update({status:"escalated",mode:"human",priority:"high",updated_at:new Date().toISOString(),conversation_state:{human_requested:true,reason}}).eq("id",candidate);await service!.from("adminos_automation_events").insert({event_type:"whatsapp.escalated",entity_type:"whatsapp_thread",entity_id:candidate,contact_id:t.data.contact_id||contactId,payload:{reason,risk:"amber",persona:"Dimpho",source:"request_human_support"}}).catch(()=>null);await notifyOwnerEscalation(candidate,reason,t.data.contact_id||contactId,t.data.channel_address||null);updated=true;}} return{escalated:true,human_support_requested:true,thread_updated:updated,owner_alert_requested:Boolean(candidate),reason};
  }
  throw new Error("Unsupported tool");
}

serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:cors});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  if(!service||!anonKey)return json({error:"Runtime not configured"},500);
  const started=Date.now(); const body=await req.json().catch(()=>({})); const toolKey=safeText(body.tool||body.tool_key,120); if(!toolKey)return json({error:"tool is required"},400); const who=await caller(req,body);
  const {data:tool,error:toolErr}=await service.from("dimpho_tools").select("*").eq("tool_key",toolKey).eq("enabled",true).maybeSingle(); if(toolErr||!tool)return json({error:"Tool unavailable"},404);
  const contextUserId=body.context_user_id?safeText(body.context_user_id,64):(who.userId||null); const contactId=body.contact_id?safeText(body.contact_id,64):null; const threadRef=body.thread_ref?safeText(body.thread_ref,100):null;
  const deny=async(code:string,message:string,status=403)=>{const row=await service.from("dimpho_tool_invocations").insert({tool_id:tool.id,tool_key:toolKey,actor_user_id:who.userId,context_user_id:contextUserId,contact_id:contactId,thread_ref:threadRef,agent_run_id:body.agent_run_id||null,channel:body.channel||null,request_payload:body.arguments||{},risk_level:tool.risk_level,status:"denied",error_code:code,error_message:message,completed_at:new Date().toISOString(),duration_ms:Date.now()-started,metadata:{internal:who.internal,release:"rk-brain-compatible"}}).select("id").single();return json({error:message,code,invocation_id:row.data?.id||null},status);};
  if(tool.requires_auth&&!contextUserId)return await deny("auth_required","Authenticated customer context required",401); if(!who.internal&&tool.user_scoped&&contextUserId!==who.userId&&!who.staff)return await deny("scope_denied","Tool is restricted to the signed-in customer");
  const principal=who.internal?"agent":who.staff?"staff":"user"; let allowed=!tool.requires_auth; const {data:perm}=await service.from("dimpho_tool_permissions").select("can_invoke,max_calls_per_hour").eq("tool_id",tool.id).eq("principal_type",principal).in("principal_value",[who.internal?"konnect_agent":"*",who.userId||"*"]).eq("can_invoke",true).limit(1).maybeSingle(); if(perm?.can_invoke)allowed=true; if(!allowed)return await deny("permission_denied","Tool permission denied");
  if(perm?.max_calls_per_hour){const since=new Date(Date.now()-3600000).toISOString();const c=await service.from("dimpho_tool_invocations").select("id",{count:"exact",head:true}).eq("tool_id",tool.id).eq("context_user_id",contextUserId).gte("created_at",since);if(Number(c.count||0)>=Number(perm.max_calls_per_hour))return await deny("rate_limited","Tool rate limit exceeded",429);}
  const invocation=await service.from("dimpho_tool_invocations").insert({tool_id:tool.id,tool_key:toolKey,actor_user_id:who.userId,context_user_id:contextUserId,contact_id:contactId,thread_ref:threadRef,agent_run_id:body.agent_run_id||null,channel:body.channel||null,request_payload:body.arguments||{},risk_level:tool.risk_level,status:"started",metadata:{internal:who.internal,principal,release:"rk-brain-compatible"}}).select("id").single(); if(invocation.error)return json({error:"Could not start tool invocation"},500); const invocationId=invocation.data.id;
  if(tool.requires_confirmation&&!body.confirmed){await service.from("dimpho_tool_invocations").update({status:"awaiting_confirmation",completed_at:new Date().toISOString(),duration_ms:Date.now()-started}).eq("id",invocationId);await service.from("dimpho_tool_approvals").insert({invocation_id:invocationId,status:"pending",requested_by:who.userId,expires_at:new Date(Date.now()+30*60_000).toISOString(),metadata:{confirmation_required:true}});return json({ok:false,requires_confirmation:true,invocation_id:invocationId,tool:toolKey},409);}
  if(tool.requires_aal2&&!who.internal&&body.aal2!==true){await service.from("dimpho_tool_invocations").update({status:"awaiting_approval",completed_at:new Date().toISOString(),duration_ms:Date.now()-started}).eq("id",invocationId);return json({ok:false,requires_aal2:true,invocation_id:invocationId},403);}
  try{const result=await executeTool(toolKey,body.arguments||{},contextUserId,contactId,threadRef);await service.from("dimpho_tool_invocations").update({status:"executed",response_payload:result,completed_at:new Date().toISOString(),duration_ms:Date.now()-started}).eq("id",invocationId);return json({ok:true,tool:toolKey,invocation_id:invocationId,result});}
  catch(e){const errorMessage=e instanceof Error?e.message:String(e);await service.from("dimpho_tool_invocations").update({status:"failed",error_code:"execution_failed",error_message:errorMessage,completed_at:new Date().toISOString(),duration_ms:Date.now()-started}).eq("id",invocationId);return json({ok:false,error:errorMessage,tool:toolKey,invocation_id:invocationId,release:"rk-brain-compatible"},500);}
});
