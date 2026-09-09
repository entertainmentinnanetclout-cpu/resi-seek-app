import { supabase } from "@/integrations/supabase/client";

export type TourAccess = { allowed: boolean; admin?: boolean; owner?: boolean; plan?: "standard" | "premium" | "gold" | "internal" | "standalone"; entitlements?: string[] };
type Db = any;
const db = supabase as Db;
const uploadBuckets = new Set(["tour-capture-private", "tour-masters-private", "tour-delivery-public", "tour-thumbnails-public"]);
const safe = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const unwrap = <T>(result: { data: T; error: any }, fallback?: T): T => { if (result.error) throw result.error; return (result.data ?? fallback) as T; };
const standaloneEntitlements = ["virtual_tour.create","virtual_tour.publish","virtual_tour.4k","virtual_tour.guided","virtual_tour.unlimited_scenes"];

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Authentication required");
  return data.user;
}
async function isAdmin(userId: string) {
  const result = await db.from("user_roles").select("role").eq("user_id", userId);
  if (result.error) throw result.error;
  return (result.data || []).some((row: any) => row.role === "admin");
}
async function accessForResidence(residenceId: string): Promise<TourAccess> {
  const user = await currentUser();
  if (await isAdmin(user.id)) return { allowed: true, admin: true, plan: "internal", entitlements: [...standaloneEntitlements,"virtual_tour.analytics"] };
  if (!residenceId) throw new Error("Residence is required for a residence-linked project");
  const account = await db.from("residence_portal_accounts").select("residence_id,user_id,email,is_active").eq("residence_id", residenceId).eq("is_active", true);
  if (account.error) throw account.error;
  const portal = (account.data || []).some((row: any) => row.user_id === user.id || (!row.user_id && String(row.email || "").toLowerCase() === String(user.email || "").toLowerCase()));
  if (!portal) throw new Error("Residence access denied");
  const entitlement = await db.from("virtual_tour_entitlements").select("plan,entitlements,is_active,expires_at").eq("residence_id", residenceId).eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (entitlement.error) throw entitlement.error;
  const ent = entitlement.data;
  const active = Boolean(ent) && (!ent?.expires_at || new Date(ent.expires_at).getTime() > Date.now());
  const allowed = active && (["premium","gold","internal"].includes(ent?.plan || "") || (ent?.entitlements || []).includes("virtual_tour.create"));
  return { allowed, admin: false, plan: ent?.plan || "standard", entitlements: ent?.entitlements || [] };
}
async function getTour(id: string) { return unwrap<any>(await db.from("virtual_tours").select("*").eq("id", id).maybeSingle(), null); }
async function getScene(id: string) { return unwrap<any>(await db.from("virtual_tour_scenes").select("*").eq("id", id).maybeSingle(), null); }
async function accessForTour(tour: any): Promise<TourAccess> {
  if (!tour?.id) throw new Error("Tour not found");
  const user = await currentUser();
  if (await isAdmin(user.id)) return { allowed: true, admin: true, owner: tour.created_by === user.id, plan: tour.workspace_type === "standalone" ? "standalone" : "internal", entitlements: [...standaloneEntitlements,"virtual_tour.analytics"] };
  if (tour.workspace_type === "standalone" || !tour.residence_id) {
    if (tour.created_by !== user.id) throw new Error("Standalone 360 project access denied");
    return { allowed: true, owner: true, plan: "standalone", entitlements: standaloneEntitlements };
  }
  return accessForResidence(tour.residence_id);
}
function capturePlan(profile: string) { const pitches = profile === "quick_24" ? [-35,35] : [-50,0,50]; return pitches.flatMap((pitch,ring) => Array.from({length:12},(_,i)=>({sequence:ring*12+i+1,ring,target_yaw:i*30,target_pitch:pitch}))); }
async function toursWithScenes(query: any) {
  const toursResult = await query;
  if (toursResult.error) throw toursResult.error;
  const tours = toursResult.data || [];
  const ids = tours.map((tour: any) => tour.id);
  if (!ids.length) return [];
  const scenesResult = await db.from("virtual_tour_scenes").select("id,tour_id,name,area_type,floor_label,status,quality_score,panorama_url,thumbnail_path,is_start,sort_order").in("tour_id", ids).order("sort_order");
  if (scenesResult.error) throw scenesResult.error;
  const grouped = new Map<string, any[]>();
  for (const scene of scenesResult.data || []) grouped.set(scene.tour_id, [...(grouped.get(scene.tour_id) || []), scene]);
  return tours.map((tour: any) => ({ ...tour, virtual_tour_scenes: grouped.get(tour.id) || [] }));
}

export async function tourApi<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const user = await currentUser();
  const admin = await isAdmin(user.id);

  if (action === "admin_summary") {
    if (!admin) throw new Error("God Mode required");
    const [summary,tours,residences,entitlements] = await Promise.all([
      db.rpc("virtual_tour_admin_summary"),
      db.from("virtual_tours").select("id,residence_id,created_by,workspace_type,workspace_label,title,status,quality_tier,public_token,current_version,published_at,updated_at,residence:residences!virtual_tours_residence_id_fkey(name,slug,campus)").order("updated_at",{ascending:false}).limit(100),
      db.from("residences").select("id,name,slug,campus,city").eq("is_visible",true).order("name").limit(500),
      db.from("virtual_tour_entitlements").select("*").eq("is_active",true).order("updated_at",{ascending:false}),
    ]);
    return {ok:true,summary:unwrap(summary,{}),tours:unwrap(tours,[]),residences:unwrap(residences,[]),entitlements:unwrap(entitlements,[])} as T;
  }

  if (action === "standalone_workspace") {
    const tours = await toursWithScenes(db.from("virtual_tours").select("id,residence_id,created_by,workspace_type,workspace_label,title,status,quality_tier,public_token,current_version,published_at,updated_at").eq("workspace_type","standalone").eq("created_by",user.id).order("updated_at",{ascending:false}).limit(100));
    return {ok:true,access:{allowed:true,owner:true,plan:"standalone",entitlements:standaloneEntitlements},residence:null,workspace:{type:"standalone",label:"My 360 Studio"},tours} as T;
  }

  if (action === "grant_entitlement") {
    if (!admin) throw new Error("God Mode required");
    const residenceId=safe(payload.residence_id,64); const plan=safe(payload.plan,20) as "standard"|"premium"|"gold"|"internal";
    if (!residenceId || !["standard","premium","gold","internal"].includes(plan)) throw new Error("Invalid residence or plan");
    const old=await db.from("virtual_tour_entitlements").update({is_active:false,updated_at:new Date().toISOString()}).eq("residence_id",residenceId).eq("is_active",true); if(old.error) throw old.error;
    const entitlements=plan==="gold"?["virtual_tour.create","virtual_tour.publish_request","virtual_tour.4k","virtual_tour.analytics","virtual_tour.guided","virtual_tour.unlimited_scenes"]:plan==="premium"?["virtual_tour.create","virtual_tour.publish_request","virtual_tour.4k"]:plan==="internal"?[...standaloneEntitlements,"virtual_tour.analytics"]:[];
    const row=await db.from("virtual_tour_entitlements").insert({residence_id:residenceId,plan,entitlements,is_active:true,source:"god_mode",granted_by:user.id}).select("*").single();
    return {ok:true,entitlement:unwrap(row)} as T;
  }

  if (action === "request_upgrade") {
    const residenceId=safe(payload.residence_id,64); await accessForResidence(residenceId);
    const requestedPlan=["premium","gold"].includes(payload.requested_plan)?payload.requested_plan:"gold";
    const residence=unwrap<any>(await db.from("residences").select("id,name").eq("id",residenceId).maybeSingle(),null);
    const message=`Hi ResKonnect, I would like to upgrade ${residence?.name || "my residence"} to the ${String(requestedPlan).toUpperCase()} 360 Studio plan.`;
    try { await db.from("virtual_tour_upgrade_requests").insert({residence_id:residenceId,requested_by:user.id,requested_plan:requestedPlan,status:"pending",metadata:{source:"property_os",release:"rg3-rg4"}}); } catch { /* WhatsApp fallback */ }
    return {ok:true,requested_plan:requestedPlan,whatsapp_url:`https://wa.me/27637323192?text=${encodeURIComponent(message)}`} as T;
  }

  if (action === "residence_workspace") {
    const residenceId=safe(payload.residence_id,64); const access=await accessForResidence(residenceId);
    const [residence,tours] = await Promise.all([
      db.from("residences").select("id,name,slug,campus,city,cover_image_url,image_url").eq("id",residenceId).maybeSingle(),
      toursWithScenes(db.from("virtual_tours").select("id,residence_id,created_by,workspace_type,workspace_label,title,status,quality_tier,public_token,current_version,published_at,updated_at").eq("residence_id",residenceId).order("updated_at",{ascending:false})),
    ]);
    return {ok:true,access,residence:unwrap(residence,null),workspace:{type:"residence"},tours} as T;
  }

  if (action === "analytics_summary") {
    const residenceId=safe(payload.residence_id,64); const access=await accessForResidence(residenceId);
    const analyticsAllowed=Boolean(access.admin)||access.plan==="gold"||access.plan==="internal"||(access.entitlements||[]).includes("virtual_tour.analytics");
    if(!analyticsAllowed) return {ok:true,locked:true,plan:access.plan,days:30} as T;
    const days=Math.max(1,Math.min(180,Number(payload.days||30)||30)); const since=new Date(Date.now()-days*86400000).toISOString();
    const tours=await db.from("virtual_tours").select("id,title").eq("residence_id",residenceId); if(tours.error) throw tours.error;
    const ids=(tours.data||[]).map((row:any)=>row.id); if(!ids.length) return {ok:true,locked:false,days,metrics:{tour_opens:0,unique_viewers:0,scene_views:0,conversion_actions:0,guided_starts:0,guided_completions:0},top_scenes:[]} as T;
    const events=await db.from("virtual_tour_analytics").select("tour_id,scene_id,event_type,viewer_session,created_at,metadata").in("tour_id",ids).gte("created_at",since).order("created_at",{ascending:false}).limit(10000); if(events.error) throw events.error;
    const sceneRows=await db.from("virtual_tour_scenes").select("id,name,area_type").in("tour_id",ids); if(sceneRows.error) throw sceneRows.error;
    const rows=events.data||[]; const count=(type:string)=>rows.filter((row:any)=>row.event_type===type).length;
    const conversionTypes=new Set(["listing_click","apply_click","contact_click","whatsapp_click","guided_complete","hotspot_cta"]);
    const sceneViews=new Map<string,number>(); rows.filter((row:any)=>row.event_type==="scene_view"&&row.scene_id).forEach((row:any)=>sceneViews.set(row.scene_id,(sceneViews.get(row.scene_id)||0)+1));
    const sceneMap=new Map((sceneRows.data||[]).map((scene:any)=>[scene.id,scene]));
    const topScenes=[...sceneViews.entries()].map(([sceneId,views])=>({...sceneMap.get(sceneId),scene_id:sceneId,views})).sort((a:any,b:any)=>b.views-a.views).slice(0,10);
    return {ok:true,locked:false,days,metrics:{tour_opens:count("tour_open"),unique_viewers:new Set(rows.map((row:any)=>row.viewer_session).filter(Boolean)).size,scene_views:count("scene_view"),conversion_actions:rows.filter((row:any)=>conversionTypes.has(row.event_type)).length,guided_starts:count("guided_start"),guided_completions:count("guided_complete"),fullscreen:count("fullscreen"),apply_clicks:count("apply_click"),listing_clicks:count("listing_click"),contact_clicks:count("contact_click")},top_scenes:topScenes} as T;
  }

  if (action === "create_tour") {
    const residenceId=safe(payload.residence_id,64);
    const title=safe(payload.title,160) || (residenceId ? "Residence Virtual Tour" : "My 360 View");
    if (!residenceId) {
      const row=await db.from("virtual_tours").insert({residence_id:null,created_by:user.id,workspace_type:"standalone",workspace_label:safe(payload.workspace_label,160)||title,title,description:safe(payload.description,800)||null,status:"draft",quality_tier:"standalone",metadata:{release:"standalone-v3",runtime:"direct-rls",generic_view:true}}).select("*").single();
      return {ok:true,tour:unwrap(row)} as T;
    }
    const access=await accessForResidence(residenceId); if(!access.allowed) throw new Error("360 Studio Premium or Gold entitlement required");
    const residence=unwrap<any>(await db.from("residences").select("id,name").eq("id",residenceId).maybeSingle(),null); if(!residence) throw new Error("Residence not found");
    const row=await db.from("virtual_tours").insert({residence_id:residenceId,created_by:user.id,workspace_type:"residence",workspace_label:residence.name,title:safe(payload.title,160)||`${residence.name} Virtual Tour`,description:safe(payload.description,800)||null,status:"draft",quality_tier:admin?"internal":access.plan==="gold"?"gold":"premium",metadata:{release:"v3",runtime:"direct-rls"}}).select("*").single();
    return {ok:true,tour:unwrap(row)} as T;
  }

  if (action === "create_scene") {
    const tour=await getTour(safe(payload.tour_id,64)); if(!tour) throw new Error("Tour not found"); const access=await accessForTour(tour); if(!access.allowed) throw new Error("Tour access denied");
    const count=await db.from("virtual_tour_scenes").select("id",{count:"exact",head:true}).eq("tour_id",tour.id); if(count.error) throw count.error; const n=Number(count.count||0);
    const unlimited=tour.workspace_type==="standalone"||Boolean(access.admin)||access.plan==="gold"||access.plan==="internal"||(access.entitlements||[]).includes("virtual_tour.unlimited_scenes"); const limit=unlimited?120:36; if(n>=limit) throw new Error(unlimited?"Scene safety limit reached":"Premium includes up to 36 scenes. Upgrade to Gold for extended scene capacity.");
    const sourceMode=["guided_mobile","equirectangular_import","camera_360_import"].includes(payload.source_mode)?payload.source_mode:"guided_mobile";
    const row=await db.from("virtual_tour_scenes").insert({tour_id:tour.id,name:safe(payload.name,120)||`Scene ${n+1}`,area_type:safe(payload.area_type,30)||"space",floor_label:safe(payload.floor_label,80)||null,room_label:safe(payload.room_label,80)||null,source_mode:sourceMode,sort_order:n,is_start:n===0}).select("*").single();
    if(tour.status!=="published") await db.from("virtual_tours").update({status:"capturing"}).eq("id",tour.id); return {ok:true,scene:unwrap(row)} as T;
  }

  if (action === "start_capture") {
    const scene=await getScene(safe(payload.scene_id,64)); if(!scene) throw new Error("Scene not found"); const tour=await getTour(scene.tour_id); const access=await accessForTour(tour); if(!access.allowed) throw new Error("Scene access denied");
    const profile=payload.capture_profile==="quick_24"?"quick_24":payload.capture_profile==="import_360"?"import_360":"gold_36"; const plan=profile==="import_360"?[]:capturePlan(profile);
    const row=await db.from("virtual_tour_capture_sessions").insert({scene_id:scene.id,created_by:user.id,capture_profile:profile,target_count:profile==="import_360"?1:plan.length,completed_count:0,status:"capturing",offline_mode:Boolean(payload.offline_mode),device_info:payload.device_info||{},capture_plan:plan,metadata:{release:"v3",workspace_type:tour.workspace_type,runtime:"direct-rls"}}).select("*").single(); await db.from("virtual_tour_scenes").update({status:"capturing"}).eq("id",scene.id); return {ok:true,session:unwrap(row),capture_plan:plan} as T;
  }

  if (action === "issue_upload") {
    const scene=await getScene(safe(payload.scene_id,64)); if(!scene) throw new Error("Scene not found"); const tour=await getTour(scene.tour_id); const access=await accessForTour(tour); if(!access.allowed) throw new Error("Scene access denied");
    const bucket=safe(payload.bucket,80); if(!uploadBuckets.has(bucket)) throw new Error("Unsupported upload bucket"); const ext=safe(payload.extension,8).replace(/[^a-z0-9]/gi,"")||"jpg"; const sid=safe(payload.session_id,64)||"scene"; const kind=safe(payload.kind,40)||"asset"; const scope=tour.residence_id||tour.id; const path=`${scope}/${tour.id}/${scene.id}/${sid}/${kind}-${crypto.randomUUID()}.${ext}`; return {ok:true,bucket,path,token:""} as T;
  }

  if (action === "register_frame") {
    const sid=safe(payload.session_id,64); const session=unwrap<any>(await db.from("virtual_tour_capture_sessions").select("id,scene_id").eq("id",sid).maybeSingle(),null); if(!session) throw new Error("Capture session not found");
    const scene=await getScene(session.scene_id); const tour=await getTour(scene?.tour_id); await accessForTour(tour);
    const row=await db.from("virtual_tour_capture_frames").upsert({session_id:sid,sequence_no:Number(payload.sequence_no),storage_path:safe(payload.storage_path,500)||null,yaw:Number(payload.yaw||0),pitch:Number(payload.pitch||0),roll:Number(payload.roll||0),target_yaw:Number(payload.target_yaw||0),target_pitch:Number(payload.target_pitch||0),width:Number(payload.width||0)||null,height:Number(payload.height||0)||null,sharpness_score:Number(payload.sharpness_score||0),exposure_score:Number(payload.exposure_score||0),stability_score:Number(payload.stability_score||0),overlap_score:Number(payload.overlap_score||0),accepted:payload.accepted!==false,metadata:payload.metadata||{}},{onConflict:"session_id,sequence_no"}).select("id").single();
    const count=await db.from("virtual_tour_capture_frames").select("id",{count:"exact",head:true}).eq("session_id",sid).eq("accepted",true); if(count.error) throw count.error; const update=await db.from("virtual_tour_capture_sessions").update({completed_count:Number(count.count||0),status:"uploading"}).eq("id",sid); if(update.error) throw update.error; return {ok:true,frame_id:unwrap<any>(row).id,completed_count:Number(count.count||0)} as T;
  }

  if (action === "complete_capture") {
    const scene=await getScene(safe(payload.scene_id,64)); if(!scene) throw new Error("Scene not found"); const tour=await getTour(scene.tour_id); const access=await accessForTour(tour); if(!access.allowed) throw new Error("Scene access denied");
    const panoramaPath=safe(payload.panorama_path,600); if(!panoramaPath) throw new Error("4K panorama_path is required"); const thumbPath=safe(payload.thumbnail_path,600); const publicUrl=supabase.storage.from("tour-delivery-public").getPublicUrl(panoramaPath).data.publicUrl; const thumbUrl=thumbPath?supabase.storage.from("tour-thumbnails-public").getPublicUrl(thumbPath).data.publicUrl:null;
    const update=await db.from("virtual_tour_scenes").update({status:"processing",panorama_path:panoramaPath,panorama_url:publicUrl,thumbnail_path:thumbUrl||thumbPath||null,master_path:safe(payload.master_path,600)||panoramaPath,width:Number(payload.width||4096),height:Number(payload.height||2048),capture_health:payload.metrics||{},metadata:{...(scene.metadata||{}),release:"v3",assembler:"client-cylindrical-v2",workspace_type:tour.workspace_type,runtime:"direct-rls"}}).eq("id",scene.id); if(update.error) throw update.error;
    if(payload.session_id){const sessionUpdate=await db.from("virtual_tour_capture_sessions").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",payload.session_id);if(sessionUpdate.error)throw sessionUpdate.error;}
    const qa=await db.rpc("virtual_tour_scene_quality_upsert",{p_scene_id:scene.id,p_metrics:payload.metrics||{},p_privacy_issues:Array.isArray(payload.privacy_issues)?payload.privacy_issues:[]}); if(qa.error){await db.from("virtual_tour_scenes").update({status:"review"}).eq("id",scene.id); return {ok:true,scene_id:scene.id,panorama_url:publicUrl,warning:qa.error.message} as T;} return {ok:true,scene_id:scene.id,panorama_url:publicUrl,thumbnail_url:thumbUrl,quality:qa.data||null} as T;
  }

  if (action === "set_start_scene") {
    const scene=await getScene(safe(payload.scene_id,64)); if(!scene) throw new Error("Scene not found"); const tour=await getTour(scene.tour_id); await accessForTour(tour);
    const clear=await db.from("virtual_tour_scenes").update({is_start:false}).eq("tour_id",scene.tour_id); if(clear.error) throw clear.error; const set=await db.from("virtual_tour_scenes").update({is_start:true}).eq("id",scene.id); if(set.error) throw set.error; const cover=await db.from("virtual_tours").update({cover_scene_id:scene.id}).eq("id",scene.tour_id); if(cover.error) throw cover.error; return {ok:true} as T;
  }

  if (action === "upsert_connection") {
    const tour=await getTour(safe(payload.tour_id,64)); await accessForTour(tour);
    const from=await getScene(safe(payload.from_scene_id,64)); const to=await getScene(safe(payload.to_scene_id,64)); if(!from||!to||from.tour_id!==tour.id||to.tour_id!==tour.id) throw new Error("Connections must stay inside one 360 project");
    const row=await db.from("virtual_tour_connections").upsert({tour_id:tour.id,from_scene_id:from.id,to_scene_id:to.id,label:safe(payload.label,100)||"Continue",yaw:Number(payload.yaw||0),pitch:Number(payload.pitch||0),icon:safe(payload.icon,30)||"arrow",is_enabled:true,sort_order:Number(payload.sort_order||0),metadata:payload.metadata||{}},{onConflict:"from_scene_id,to_scene_id,label"}).select("*").single(); return {ok:true,connection:unwrap(row)} as T;
  }

  if (action === "create_hotspot") {
    const tour=await getTour(safe(payload.tour_id,64)); await accessForTour(tour); const scene=await getScene(safe(payload.scene_id,64)); if(!scene||scene.tour_id!==tour.id) throw new Error("Hotspot scene is outside this project");
    const row=await db.from("virtual_tour_hotspots").insert({tour_id:tour.id,scene_id:scene.id,hotspot_type:safe(payload.hotspot_type,30)||"info",target_scene_id:payload.target_scene_id||null,label:safe(payload.label,120)||"Info",body:safe(payload.body,1000)||null,cta_url:safe(payload.cta_url,600)||null,yaw:Number(payload.yaw||0),pitch:Number(payload.pitch||0),is_enabled:true,sort_order:Number(payload.sort_order||0),metadata:payload.metadata||{}}).select("*").single(); return {ok:true,hotspot:unwrap(row)} as T;
  }

  if (action === "tour_builder") {
    const tour=await getTour(safe(payload.tour_id,64)); if(!tour) throw new Error("Tour not found"); const access=await accessForTour(tour);
    const [scenes,connections,hotspots,readiness]=await Promise.all([db.from("virtual_tour_scenes").select("*").eq("tour_id",tour.id).order("sort_order"),db.from("virtual_tour_connections").select("*").eq("tour_id",tour.id).order("sort_order"),db.from("virtual_tour_hotspots").select("*").eq("tour_id",tour.id).order("sort_order"),db.rpc("virtual_tour_publish_readiness",{p_tour_id:tour.id})]);
    return {ok:true,tour,access,scenes:unwrap(scenes,[]),connections:unwrap(connections,[]),hotspots:unwrap(hotspots,[]),readiness:unwrap(readiness,{})} as T;
  }

  if (action === "submit_review") {
    const tour=await getTour(safe(payload.tour_id,64)); if(!tour) throw new Error("Tour not found"); await accessForTour(tour); const readiness=await db.rpc("virtual_tour_publish_readiness",{p_tour_id:tour.id}); if(readiness.error) throw readiness.error; if(!readiness.data?.publishable) throw new Error("Tour is not ready for review"); const update=await db.from("virtual_tours").update({status:"review"}).eq("id",tour.id); if(update.error) throw update.error; return {ok:true,readiness:readiness.data} as T;
  }

  if (action === "publish_tour") {
    const tour=await getTour(safe(payload.tour_id,64)); if(!tour) throw new Error("Tour not found"); const access=await accessForTour(tour); if(tour.workspace_type!=="standalone"&&!admin) throw new Error("God Mode approval required to publish a residence tour"); if(tour.workspace_type==="standalone"&&!access.owner&&!admin) throw new Error("Only the project owner can publish this standalone view");
    const result=await db.rpc("virtual_tour_publish_snapshot",{p_tour_id:tour.id,p_published_by:user.id}); if(result.error) throw result.error; return {ok:true,release:result.data,public_url:`https://www.reskonnect.org/tour/${result.data.public_token}`} as T;
  }

  if (action === "archive_tour") {
    const tour=await getTour(safe(payload.tour_id,64)); if(!tour) throw new Error("Tour not found"); await accessForTour(tour); const update=await db.from("virtual_tours").update({status:"archived",is_current:false}).eq("id",tour.id); if(update.error) throw update.error; return {ok:true} as T;
  }
  throw new Error(`Unknown 360 Studio action: ${action}`);
}

export async function uploadSignedAsset(input: { bucket: string; path: string; token?: string; file: Blob; contentType?: string }) {
  const storage=supabase.storage.from(input.bucket); const options={contentType:input.contentType||input.file.type||"image/jpeg",upsert:false}; const result=input.token?await storage.uploadToSignedUrl(input.path,input.token,input.file,options):await storage.upload(input.path,input.file,options); if(result.error) throw result.error; return input.path;
}
export async function publicTourForResidence(residenceId: string) {
  if (!residenceId) return null;
  const now=new Date().toISOString();
  const result=await db.from("virtual_tour_publications").select("tour_id,residence_id,version_number,public_token,published_at,valid_until,status").eq("residence_id",residenceId).eq("status","published").or(`valid_until.is.null,valid_until.gt.${now}`).order("published_at",{ascending:false}).limit(1).maybeSingle();
  if(result.error){console.warn("[360 Studio] marketplace lookup failed",result.error);return null;} return result.data||null;
}
export async function publicTourSnapshot(publicToken: string) { const {data,error}=await db.rpc("virtual_tour_public_snapshot",{p_public_token:publicToken}); if(error) throw error; return data||{}; }
export async function recordTourEvent(input: { tourId: string; sceneId?: string | null; eventType: string; viewerSession: string; anonymousId?: string; metadata?: Record<string, unknown> }) { const {error}=await db.rpc("record_virtual_tour_event",{p_tour_id:input.tourId,p_scene_id:input.sceneId||null,p_event_type:input.eventType,p_viewer_session:input.viewerSession,p_anonymous_id:input.anonymousId||null,p_metadata:input.metadata||{}}); if(error) console.warn("[360 Studio] analytics event failed",error); }
