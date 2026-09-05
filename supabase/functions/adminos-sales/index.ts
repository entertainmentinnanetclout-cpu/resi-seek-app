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

const stages = ["new","contacted","qualified","interested","application_started","documents_pending","lease_pending","ready","approved","converted","onboarded","follow_up_later","not_interested","invalid","lost","do_not_contact"];
const terminal = new Set(["converted","onboarded","not_interested","invalid","lost","do_not_contact"]);

async function staffAuth(req: Request, service: any) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader || !anonKey) return { ok: false, userId: null, role: null };
  const auth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data } = await auth.auth.getUser();
  const user = data?.user;
  if (!user) return { ok: false, userId: null, role: null };
  const roleRes = await service.rpc("get_user_staff_role", { _user_id: user.id });
  return { ok: Boolean(roleRes.data), userId: roleRes.data ? user.id : null, role: roleRes.data || null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase runtime is not configured" }, 500);

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const authz = await staffAuth(req, service);
  if (!authz.ok) return json({ error: "Staff access required" }, 403);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "health");

  if (action === "health") {
    const [all, hot, overdue] = await Promise.all([
      service.from("adminos_prospects").select("id", { count: "exact", head: true }),
      service.from("adminos_prospects").select("id", { count: "exact", head: true }).gte("score", 80).eq("automation_state", "eligible"),
      service.from("adminos_prospects").select("id", { count: "exact", head: true }).gte("score", 70).lt("next_action_at", new Date().toISOString()),
    ]);
    return json({ ok: true, release: 4, phase: 9, prospects: all.count || 0, hot: hot.count || 0, overdue: overdue.count || 0, auto_contact: false });
  }

  if (action === "rescore") {
    const prospectId = String(body.prospect_id || "");
    if (!prospectId) return json({ error: "prospect_id is required" }, 400);
    const { data, error } = await service.rpc("adminos_recalculate_prospect_score", { p_prospect_id: prospectId });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, result: data, release: 4, phase: 9 });
  }

  if (action === "rescore_all") {
    const limit = Math.max(1, Math.min(5000, Number(body.limit || 5000)));
    const { data, error } = await service.rpc("adminos_recalculate_all_prospects", { p_limit: limit });
    if (error) return json({ error: error.message }, 400);
    await service.from("adminos_audit_events").insert({ actor_type: "staff", actor_id: authz.userId, action: "sales.rescore_all", entity_type: "adminos_release", after_state: data || {}, metadata: { release: 4, phase: 9 } });
    return json({ ok: true, result: data, release: 4, phase: 9 });
  }

  if (action === "pipeline") {
    const pipeline = String(body.pipeline || "accommodation");
    const limit = Math.max(1, Math.min(250, Number(body.limit || 100)));
    let q = service.from("adminos_sales_pipeline_v").select("*").eq("pipeline", pipeline).order("score", { ascending: false }).limit(limit);
    if (body.stage) q = q.eq("stage", String(body.stage));
    if (body.campus) q = q.ilike("campus", `%${String(body.campus).slice(0,120)}%`);
    if (body.min_score != null) q = q.gte("score", Number(body.min_score));
    const { data, error } = await q;
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, prospects: data || [], release: 4, phase: 9 });
  }

  if (action === "update_stage") {
    const prospectId = String(body.prospect_id || "");
    const stage = String(body.stage || "");
    if (!prospectId || !stages.includes(stage)) return json({ error: "Valid prospect_id and stage are required" }, 400);
    const current = await service.from("adminos_prospects").select("id,contact_id,stage,score,metadata").eq("id", prospectId).maybeSingle();
    if (!current.data) return json({ error: "Prospect not found" }, 404);
    const patch: any = { stage, updated_at: new Date().toISOString() };
    if (stage === "qualified") patch.qualified_at = new Date().toISOString();
    if (["converted","onboarded"].includes(stage)) patch.converted_at = new Date().toISOString();
    if (terminal.has(stage)) patch.automation_state = "completed";
    if (stage === "do_not_contact") {
      patch.automation_state = "blocked";
      await service.from("adminos_communication_preferences").upsert({ contact_id: current.data.contact_id, do_not_contact: true, marketing_allowed: false, updated_at: new Date().toISOString() }, { onConflict: "contact_id" });
    }
    const updated = await service.from("adminos_prospects").update(patch).eq("id", prospectId).select("*").single();
    if (updated.error) return json({ error: updated.error.message }, 400);
    await service.from("adminos_pipeline_events").insert({ prospect_id: prospectId, contact_id: current.data.contact_id, event_type: "stage.changed", from_stage: current.data.stage, to_stage: stage, score_before: current.data.score, score_after: current.data.score, actor_type: "staff", actor_id: authz.userId, payload: { release: 4, phase: 9 } });
    await service.rpc("adminos_recalculate_prospect_score", { p_prospect_id: prospectId });
    return json({ ok: true, prospect: updated.data, release: 4, phase: 9 });
  }

  if (action === "set_next_action") {
    const prospectId = String(body.prospect_id || "");
    if (!prospectId) return json({ error: "prospect_id is required" }, 400);
    const patch = { next_action: body.next_action ? String(body.next_action).slice(0,500) : null, next_action_at: body.next_action_at || null, owner_id: body.owner_id || authz.userId, updated_at: new Date().toISOString() };
    const result = await service.from("adminos_prospects").update(patch).eq("id", prospectId).select("*").single();
    if (result.error) return json({ error: result.error.message }, 400);
    return json({ ok: true, prospect: result.data });
  }

  if (action === "enroll_followup") {
    const prospectId = String(body.prospect_id || "");
    const sequenceKey = String(body.sequence_key || "accommodation_application_nurture_v1");
    if (!prospectId) return json({ error: "prospect_id is required" }, 400);
    const prospect = await service.from("adminos_prospects").select("id,contact_id,automation_state").eq("id", prospectId).maybeSingle();
    if (!prospect.data) return json({ error: "Prospect not found" }, 404);
    if (prospect.data.automation_state !== "eligible") return json({ error: `Prospect automation is ${prospect.data.automation_state}` }, 409);
    const prefs = await service.from("adminos_communication_preferences").select("do_not_contact").eq("contact_id", prospect.data.contact_id).maybeSingle();
    if (prefs.data?.do_not_contact) return json({ error: "Contact is do-not-contact" }, 403);
    const sequence = await service.from("adminos_followup_sequences").select("id,sequence_key").eq("sequence_key", sequenceKey).eq("enabled", true).maybeSingle();
    if (!sequence.data) return json({ error: "Follow-up sequence is unavailable" }, 404);
    const first = await service.from("adminos_followup_steps").select("delay_minutes").eq("sequence_id", sequence.data.id).eq("step_order", 1).eq("enabled", true).maybeSingle();
    if (!first.data) return json({ error: "Follow-up sequence has no first step" }, 409);
    const nextRun = new Date(Date.now() + Number(first.data.delay_minutes || 0) * 60000).toISOString();
    const enrollment = await service.from("adminos_followup_enrollments").insert({ sequence_id: sequence.data.id, contact_id: prospect.data.contact_id, prospect_id: prospectId, status: "active", current_step: 0, next_run_at: nextRun, metadata: { release: 4, phase: 9, source: "sales_command", enrolled_by: authz.userId } }).select("*").single();
    if (enrollment.error) return json({ error: enrollment.error.message }, 409);
    return json({ ok: true, enrollment: enrollment.data, external_message_sent: false });
  }

  return json({ error: "Unsupported action" }, 400);
});