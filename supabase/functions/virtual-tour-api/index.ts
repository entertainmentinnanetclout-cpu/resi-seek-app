import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const service = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;
const safe = (value: unknown, max = 180) => String(value ?? "").trim().slice(0, max);
const uuidLike = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(value || ""));
const uploadBuckets = new Set(["tour-capture-private", "tour-masters-private", "tour-delivery-public", "tour-thumbnails-public"]);

async function identity(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth || !anonKey || !service) return null;
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const user = (await client.auth.getUser()).data?.user || null;
  if (!user) return null;
  const roles = await service.from("user_roles").select("role").eq("user_id", user.id);
  const admin = (roles.data || []).some((row: any) => row.role === "admin");
  return { user, admin };
}

async function portalResidence(user: any, residenceId: string) {
  if (!service) return false;
  const { data } = await service.from("residence_portal_accounts")
    .select("residence_id,user_id,email,is_active")
    .eq("residence_id", residenceId)
    .eq("is_active", true);
  return (data || []).some((row: any) => row.user_id === user.id || (!row.user_id && String(row.email || "").toLowerCase() === String(user.email || "").toLowerCase()));
}

async function entitlement(residenceId: string) {
  const { data } = await service!.from("virtual_tour_entitlements")
    .select("plan,entitlements,is_active,expires_at")
    .eq("residence_id", residenceId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const active = Boolean(data) && (!data?.expires_at || new Date(data.expires_at).getTime() > Date.now());
  const allowed = active && (["premium", "gold", "internal"].includes(data?.plan || "") || (data?.entitlements || []).includes("virtual_tour.create"));
  return { allowed, plan: data?.plan || "standard", entitlements: data?.entitlements || [] };
}

async function canManage(who: any, residenceId: string) {
  if (!who) return { allowed: false, plan: "standard" };
  if (who.admin) return { allowed: true, plan: "internal", admin: true };
  const portal = await portalResidence(who.user, residenceId);
  if (!portal) return { allowed: false, plan: "standard" };
  const ent = await entitlement(residenceId);
  return { ...ent, admin: false };
}

async function tourOwned(who: any, tourId: string) {
  const tour = (await service!.from("virtual_tours").select("id,residence_id,status,public_token,title,quality_tier").eq("id", tourId).maybeSingle()).data;
  if (!tour) return { tour: null, access: { allowed: false } };
  return { tour, access: await canManage(who, tour.residence_id) };
}

async function sceneOwned(who: any, sceneId: string) {
  const scene = (await service!.from("virtual_tour_scenes").select("id,tour_id,name,status,source_mode").eq("id", sceneId).maybeSingle()).data;
  if (!scene) return { scene: null, tour: null, access: { allowed: false } };
  const t = await tourOwned(who, scene.tour_id);
  return { scene, ...t };
}

function capturePlan(profile: string) {
  const pitches = profile === "quick_24" ? [-35, 35] : [-50, 0, 50];
  const points: any[] = [];
  pitches.forEach((pitch, ring) => {
    for (let i = 0; i < 12; i++) points.push({ sequence: points.length + 1, ring, target_yaw: i * 30, target_pitch: pitch });
  });
  return points;
}

async function processor(payload: any) {
  const response = await fetch(`${supabaseUrl}/functions/v1/virtual-tour-processor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tour-internal": serviceKey, apikey: serviceKey },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Processor HTTP ${response.status}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!service || !anonKey) return json({ error: "Runtime not configured" }, 500);
  const who = await identity(req);
  if (!who) return json({ error: "Authentication required" }, 401);
  const body = await req.json().catch(() => ({}));
  const action = safe(body.action, 80) || "health";

  if (action === "health") return json({ ok: true, service: "virtual-tour-api", release: "v2", release_gates: [1, 2], phases: [0,1,2,3,4,5,6] });

  if (action === "admin_summary") {
    if (!who.admin) return json({ error: "God Mode required" }, 403);
    const [summary, tours, residences] = await Promise.all([
      service.rpc("virtual_tour_admin_summary"),
      service.from("virtual_tours").select("id,residence_id,title,status,quality_tier,public_token,current_version,published_at,updated_at,residences(name,slug,campus)").order("updated_at", { ascending: false }).limit(100),
      service.from("residences").select("id,name,slug,campus,city").eq("is_visible", true).order("name").limit(500),
    ]);
    return json({ ok: true, summary: summary.data || {}, tours: tours.data || [], residences: residences.data || [] });
  }

  if (action === "grant_entitlement") {
    if (!who.admin) return json({ error: "God Mode required" }, 403);
    const residenceId = safe(body.residence_id, 64); const plan = safe(body.plan, 20);
    if (!uuidLike(residenceId) || !["standard","premium","gold","internal"].includes(plan)) return json({ error: "Invalid residence or plan" }, 400);
    await service.from("virtual_tour_entitlements").update({ is_active: false, updated_at: new Date().toISOString() }).eq("residence_id", residenceId).eq("is_active", true);
    const entitlements = plan === "gold" ? ["virtual_tour.create","virtual_tour.publish_request","virtual_tour.4k","virtual_tour.analytics","virtual_tour.guided","virtual_tour.unlimited_scenes"] : plan === "premium" ? ["virtual_tour.create","virtual_tour.publish_request","virtual_tour.4k"] : plan === "internal" ? ["virtual_tour.create","virtual_tour.publish","virtual_tour.4k","virtual_tour.analytics","virtual_tour.guided","virtual_tour.unlimited_scenes"] : [];
    const row = await service.from("virtual_tour_entitlements").insert({ residence_id: residenceId, plan, entitlements, is_active: true, source: "god_mode", granted_by: who.user.id }).select("*").single();
    if (row.error) return json({ error: row.error.message }, 500);
    return json({ ok: true, entitlement: row.data });
  }

  if (action === "residence_workspace") {
    const residenceId = safe(body.residence_id, 64);
    const access = await canManage(who, residenceId);
    const portal = await portalResidence(who.user, residenceId);
    if (!who.admin && !portal) return json({ error: "Residence access denied" }, 403);
    const [residence, tours] = await Promise.all([
      service.from("residences").select("id,name,slug,campus,city,cover_image_url,image_url").eq("id", residenceId).maybeSingle(),
      service.from("virtual_tours").select("id,title,status,quality_tier,public_token,current_version,published_at,updated_at,virtual_tour_scenes(id,name,area_type,floor_label,status,quality_score,panorama_url,thumbnail_path,is_start,sort_order)").eq("residence_id", residenceId).order("updated_at", { ascending: false }),
    ]);
    return json({ ok: true, access, residence: residence.data, tours: tours.data || [] });
  }

  if (action === "create_tour") {
    const residenceId = safe(body.residence_id, 64); const access = await canManage(who, residenceId);
    if (!access.allowed) return json({ error: "360 Studio entitlement required", access }, 403);
    const residence = (await service.from("residences").select("id,name").eq("id", residenceId).maybeSingle()).data;
    if (!residence) return json({ error: "Residence not found" }, 404);
    const row = await service.from("virtual_tours").insert({ residence_id: residenceId, created_by: who.user.id, title: safe(body.title, 160) || `${residence.name} Virtual Tour`, description: safe(body.description, 800) || null, status: "draft", quality_tier: who.admin ? "internal" : access.plan === "gold" ? "gold" : "premium", metadata: { release: "v2" } }).select("*").single();
    if (row.error) return json({ error: row.error.message }, 500);
    return json({ ok: true, tour: row.data });
  }

  if (action === "create_scene") {
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour || !owned.access.allowed) return json({ error: "Tour access denied" }, 403);
    const count = await service.from("virtual_tour_scenes").select("id", { count: "exact", head: true }).eq("tour_id", tourId);
    if (Number(count.count || 0) >= 120) return json({ error: "Scene limit reached" }, 409);
    const sourceMode = ["guided_mobile","equirectangular_import","camera_360_import"].includes(body.source_mode) ? body.source_mode : "guided_mobile";
    const scene = await service.from("virtual_tour_scenes").insert({ tour_id: tourId, name: safe(body.name, 120) || `Scene ${Number(count.count || 0) + 1}`, area_type: safe(body.area_type, 30) || "room", floor_label: safe(body.floor_label, 80) || null, room_label: safe(body.room_label, 80) || null, source_mode: sourceMode, sort_order: Number(count.count || 0), is_start: Number(count.count || 0) === 0 }).select("*").single();
    if (scene.error) return json({ error: scene.error.message }, 500);
    await service.from("virtual_tours").update({ status: "capturing" }).eq("id", tourId).neq("status", "published");
    return json({ ok: true, scene: scene.data });
  }

  if (action === "start_capture") {
    const sceneId = safe(body.scene_id, 64); const owned = await sceneOwned(who, sceneId);
    if (!owned.scene || !owned.access.allowed) return json({ error: "Scene access denied" }, 403);
    const profile = body.capture_profile === "quick_24" ? "quick_24" : body.capture_profile === "import_360" ? "import_360" : "gold_36";
    const plan = profile === "import_360" ? [] : capturePlan(profile);
    const session = await service.from("virtual_tour_capture_sessions").insert({ scene_id: sceneId, created_by: who.user.id, capture_profile: profile, target_count: profile === "import_360" ? 1 : plan.length, completed_count: 0, status: "capturing", offline_mode: Boolean(body.offline_mode), device_info: body.device_info || {}, capture_plan: plan, metadata: { release: "v2" } }).select("*").single();
    if (session.error) return json({ error: session.error.message }, 500);
    await service.from("virtual_tour_scenes").update({ status: "capturing" }).eq("id", sceneId);
    return json({ ok: true, session: session.data, capture_plan: plan });
  }

  if (action === "issue_upload") {
    const sceneId = safe(body.scene_id, 64); const owned = await sceneOwned(who, sceneId);
    if (!owned.scene || !owned.access.allowed) return json({ error: "Scene access denied" }, 403);
    const bucket = safe(body.bucket, 80); if (!uploadBuckets.has(bucket)) return json({ error: "Unsupported upload bucket" }, 400);
    const ext = safe(body.extension, 8).replace(/[^a-z0-9]/gi, "") || "jpg";
    const sessionId = safe(body.session_id, 64) || "scene";
    const kind = safe(body.kind, 40) || "asset";
    const path = `${owned.tour.residence_id}/${owned.tour.id}/${sceneId}/${sessionId}/${kind}-${crypto.randomUUID()}.${ext}`;
    const signed = await service.storage.from(bucket).createSignedUploadUrl(path);
    if (signed.error) return json({ error: signed.error.message }, 500);
    return json({ ok: true, bucket, path, token: signed.data.token, signed_url: signed.data.signedUrl });
  }

  if (action === "register_frame") {
    const sceneId = safe(body.scene_id, 64); const owned = await sceneOwned(who, sceneId);
    if (!owned.scene || !owned.access.allowed) return json({ error: "Scene access denied" }, 403);
    const sessionId = safe(body.session_id, 64);
    const session = (await service.from("virtual_tour_capture_sessions").select("id,scene_id").eq("id", sessionId).eq("scene_id", sceneId).maybeSingle()).data;
    if (!session) return json({ error: "Capture session not found" }, 404);
    const row = await service.from("virtual_tour_capture_frames").upsert({ session_id: sessionId, sequence_no: Number(body.sequence_no), storage_path: safe(body.storage_path, 500) || null, yaw: Number(body.yaw || 0), pitch: Number(body.pitch || 0), roll: Number(body.roll || 0), target_yaw: Number(body.target_yaw || 0), target_pitch: Number(body.target_pitch || 0), width: Number(body.width || 0) || null, height: Number(body.height || 0) || null, sharpness_score: Number(body.sharpness_score || 0), exposure_score: Number(body.exposure_score || 0), stability_score: Number(body.stability_score || 0), overlap_score: Number(body.overlap_score || 0), accepted: body.accepted !== false, metadata: body.metadata || {} }, { onConflict: "session_id,sequence_no" }).select("id").single();
    if (row.error) return json({ error: row.error.message }, 500);
    const count = await service.from("virtual_tour_capture_frames").select("id", { count: "exact", head: true }).eq("session_id", sessionId).eq("accepted", true);
    await service.from("virtual_tour_capture_sessions").update({ completed_count: Number(count.count || 0), status: "uploading" }).eq("id", sessionId);
    return json({ ok: true, frame_id: row.data.id, completed_count: Number(count.count || 0) });
  }

  if (action === "complete_capture") {
    const sceneId = safe(body.scene_id, 64); const owned = await sceneOwned(who, sceneId);
    if (!owned.scene || !owned.access.allowed) return json({ error: "Scene access denied" }, 403);
    const sessionId = safe(body.session_id, 64);
    const panoramaPath = safe(body.panorama_path, 600); const thumbnailPath = safe(body.thumbnail_path, 600);
    if (!panoramaPath) return json({ error: "4K panorama_path is required" }, 400);
    const publicUrl = service.storage.from("tour-delivery-public").getPublicUrl(panoramaPath).data.publicUrl;
    const thumbUrl = thumbnailPath ? service.storage.from("tour-thumbnails-public").getPublicUrl(thumbnailPath).data.publicUrl : null;
    await service.from("virtual_tour_processing_jobs").insert({ tour_id: owned.tour.id, scene_id: sceneId, job_type: "assemble", status: "completed", progress: 100, input_payload: { session_id: sessionId, engine: "client-cylindrical-v2" }, output_payload: { panorama_path: panoramaPath, width: Number(body.width || 4096), height: Number(body.height || 2048) }, started_at: new Date().toISOString(), completed_at: new Date().toISOString() });
    await service.from("virtual_tour_scenes").update({ status: "processing", panorama_path: panoramaPath, panorama_url: publicUrl, thumbnail_path: thumbUrl || thumbnailPath || null, master_path: safe(body.master_path, 600) || panoramaPath, width: Number(body.width || 4096), height: Number(body.height || 2048), capture_health: body.metrics || {}, metadata: { release: "v2", assembler: "client-cylindrical-v2", source_mode: owned.scene.source_mode } }).eq("id", sceneId);
    if (sessionId) await service.from("virtual_tour_capture_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionId);
    try {
      const qa = await processor({ action: "quality_check", scene_id: sceneId, metrics: body.metrics || {}, privacy_issues: body.privacy_issues || [] });
      return json({ ok: true, scene_id: sceneId, panorama_url: publicUrl, thumbnail_url: thumbUrl, quality: qa.quality || null });
    } catch (error: any) {
      await service.from("virtual_tour_scenes").update({ status: "review" }).eq("id", sceneId);
      return json({ ok: true, scene_id: sceneId, panorama_url: publicUrl, warning: error?.message || "Quality worker deferred" });
    }
  }

  if (action === "set_start_scene") {
    const sceneId = safe(body.scene_id, 64); const owned = await sceneOwned(who, sceneId);
    if (!owned.scene || !owned.access.allowed) return json({ error: "Scene access denied" }, 403);
    await service.from("virtual_tour_scenes").update({ is_start: false }).eq("tour_id", owned.tour.id);
    await service.from("virtual_tour_scenes").update({ is_start: true }).eq("id", sceneId);
    await service.from("virtual_tours").update({ cover_scene_id: sceneId }).eq("id", owned.tour.id);
    return json({ ok: true });
  }

  if (action === "upsert_connection") {
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour || !owned.access.allowed) return json({ error: "Tour access denied" }, 403);
    const from = safe(body.from_scene_id, 64), to = safe(body.to_scene_id, 64);
    if (!from || !to || from === to) return json({ error: "Valid scene connection required" }, 400);
    const row = await service.from("virtual_tour_connections").upsert({ tour_id: tourId, from_scene_id: from, to_scene_id: to, label: safe(body.label, 100) || "Continue", yaw: Number(body.yaw || 0), pitch: Number(body.pitch || 0), icon: safe(body.icon, 30) || "arrow", is_enabled: true, sort_order: Number(body.sort_order || 0), metadata: body.metadata || {} }, { onConflict: "from_scene_id,to_scene_id,label" }).select("*").single();
    if (row.error) return json({ error: row.error.message }, 500);
    return json({ ok: true, connection: row.data });
  }

  if (action === "create_hotspot") {
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour || !owned.access.allowed) return json({ error: "Tour access denied" }, 403);
    const row = await service.from("virtual_tour_hotspots").insert({ tour_id: tourId, scene_id: safe(body.scene_id, 64), hotspot_type: safe(body.hotspot_type, 30) || "info", target_scene_id: safe(body.target_scene_id, 64) || null, label: safe(body.label, 120) || "Info", body: safe(body.body, 1000) || null, cta_url: safe(body.cta_url, 600) || null, yaw: Number(body.yaw || 0), pitch: Number(body.pitch || 0), is_enabled: true, sort_order: Number(body.sort_order || 0), metadata: body.metadata || {} }).select("*").single();
    if (row.error) return json({ error: row.error.message }, 500);
    return json({ ok: true, hotspot: row.data });
  }

  if (action === "tour_builder") {
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour || !owned.access.allowed) return json({ error: "Tour access denied" }, 403);
    const [scenes, connections, hotspots, readiness] = await Promise.all([
      service.from("virtual_tour_scenes").select("*").eq("tour_id", tourId).order("sort_order"),
      service.from("virtual_tour_connections").select("*").eq("tour_id", tourId).order("sort_order"),
      service.from("virtual_tour_hotspots").select("*").eq("tour_id", tourId).order("sort_order"),
      service.rpc("virtual_tour_publish_readiness", { p_tour_id: tourId }),
    ]);
    return json({ ok: true, tour: owned.tour, scenes: scenes.data || [], connections: connections.data || [], hotspots: hotspots.data || [], readiness: readiness.data || {} });
  }

  if (action === "submit_review") {
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour || !owned.access.allowed) return json({ error: "Tour access denied" }, 403);
    const readiness = await service.rpc("virtual_tour_publish_readiness", { p_tour_id: tourId });
    if (!readiness.data?.publishable) return json({ error: "Tour is not ready for review", readiness: readiness.data }, 409);
    await service.from("virtual_tours").update({ status: "review" }).eq("id", tourId);
    return json({ ok: true, readiness: readiness.data });
  }

  if (action === "publish_tour") {
    if (!who.admin) return json({ error: "God Mode approval required to publish" }, 403);
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour) return json({ error: "Tour not found" }, 404);
    const publish = await service.rpc("virtual_tour_publish_snapshot", { p_tour_id: tourId, p_published_by: who.user.id });
    if (publish.error) return json({ error: publish.error.message }, 409);
    return json({ ok: true, release: publish.data, public_url: `https://www.reskonnect.org/tour/${publish.data.public_token}` });
  }

  if (action === "archive_tour") {
    const tourId = safe(body.tour_id, 64); const owned = await tourOwned(who, tourId);
    if (!owned.tour || !owned.access.allowed) return json({ error: "Tour access denied" }, 403);
    await service.from("virtual_tours").update({ status: "archived", is_current: false }).eq("id", tourId);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
