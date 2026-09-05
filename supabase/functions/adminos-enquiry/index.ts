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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase runtime is not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: authError } = await authClient.auth.getUser();
  const user = userData?.user;
  if (authError || !user) return json({ error: "Sign in is required for account-specific enquiries" }, 401);

  const body = await req.json().catch(() => ({}));
  const message = String(body.message || "").trim().slice(0, 8000);
  if (!message) return json({ error: "Message is required" }, 400);

  const { data: profile } = await service.from("profiles").select("id,full_name,email,phone,phone_number,campus,student_number").eq("id", user.id).maybeSingle();
  if (!profile) return json({ error: "Profile not found" }, 404);

  const applicationId: string | null = body.application_id ? String(body.application_id) : null;
  if (applicationId) {
    const { data: app } = await service.from("applications").select("id,user_id").eq("id", applicationId).maybeSingle();
    if (!app || app.user_id !== user.id) return json({ error: "Application access denied" }, 403);
  }

  const { data: contactId, error: contactError } = await service.rpc("adminos_resolve_contact", {
    p_full_name: profile.full_name,
    p_email: profile.email,
    p_phone: profile.phone || profile.phone_number,
    p_profile_user_id: profile.id,
    p_source_type: "profile",
    p_source_id: profile.id,
    p_metadata: { source: "internal_enquiry" },
  });
  if (contactError || !contactId) return json({ error: "Could not resolve CRM contact" }, 500);

  let threadId = body.thread_id ? String(body.thread_id) : null;
  if (threadId) {
    const { data: thread } = await service.from("adminos_enquiry_threads").select("id,profile_user_id").eq("id", threadId).maybeSingle();
    if (!thread || thread.profile_user_id !== user.id) return json({ error: "Thread access denied" }, 403);
  } else {
    let q = service.from("adminos_enquiry_threads").select("id").eq("profile_user_id", user.id).in("status", ["open", "waiting_staff", "escalated"]).order("last_message_at", { ascending: false }).limit(1);
    if (applicationId) q = q.eq("application_id", applicationId); else q = q.is("application_id", null);
    const { data: existing } = await q.maybeSingle();
    threadId = existing?.id || null;
  }

  if (!threadId) {
    const { data: created, error } = await service.from("adminos_enquiry_threads").insert({
      contact_id: contactId, profile_user_id: user.id, application_id: applicationId,
      subject: applicationId ? "Application enquiry" : "ResKonnect enquiry",
      channel: "in_app", status: "open", metadata: { created_by: "adminos_enquiry" },
    }).select("id").single();
    if (error || !created) return json({ error: "Could not create enquiry thread" }, 500);
    threadId = created.id;
  }

  const { error: inboundError } = await service.from("adminos_enquiry_messages").insert({
    thread_id: threadId, sender_type: "user", sender_user_id: user.id, content: message,
    direction: "inbound", status: "delivered",
  });
  if (inboundError) return json({ error: "Could not save enquiry" }, 500);

  await service.from("adminos_enquiry_threads").update({ last_message_at: new Date().toISOString(), status: "open" }).eq("id", threadId);
  await service.from("adminos_automation_events").insert({
    event_type: "enquiry.received", entity_type: "enquiry_thread", entity_id: threadId, contact_id: contactId,
    payload: { application_id: applicationId, channel: "in_app" }, correlation_id: `enquiry:${threadId}:${Date.now()}`,
  });

  const agentResponse = await fetch(`${supabaseUrl}/functions/v1/adminos-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
    body: JSON.stringify({ action: "enquiry_reply", contact_id: contactId, thread_id: threadId, application_id: applicationId, message }),
  });
  const agent = await agentResponse.json().catch(() => ({}));

  if (!agentResponse.ok || !agent.answer) {
    const fallback = "I’ve saved your enquiry for the ResKonnect team because I can’t verify a safe answer right now. A staff member can review it from AdminOS.";
    await service.from("adminos_enquiry_messages").insert({
      thread_id: threadId, sender_type: "agent", content: fallback, direction: "outbound", status: "delivered", risk_level: "amber",
      metadata: { fallback: true, provider_error: agent.error || `HTTP ${agentResponse.status}` },
    });
    await service.from("adminos_enquiry_threads").update({ status: "escalated", priority: "high", last_message_at: new Date().toISOString() }).eq("id", threadId);
    await service.from("adminos_automation_events").insert({
      event_type: "enquiry.escalated", entity_type: "enquiry_thread", entity_id: threadId, contact_id: contactId,
      payload: { reason: agent.error || "agent_unavailable", application_id: applicationId }, correlation_id: `enquiry:${threadId}:escalated:${Date.now()}`,
    });
    return json({ response: fallback, thread_id: threadId, escalated: true, risk: "amber" });
  }

  const escalated = Boolean(agent.escalate) || agent.risk !== "green";
  await service.from("adminos_enquiry_messages").insert({
    thread_id: threadId, sender_type: "agent", content: String(agent.answer), direction: "outbound", status: "delivered",
    confidence: Number(agent.confidence || 0), risk_level: agent.risk || "amber", agent_run_id: agent.run_id || null,
    metadata: { provider: agent.provider, model: agent.model, reason: agent.reason },
  });
  await service.from("adminos_enquiry_threads").update({
    status: escalated ? "escalated" : "open",
    priority: agent.risk === "red" ? "urgent" : escalated ? "high" : "normal",
    last_message_at: new Date().toISOString(),
  }).eq("id", threadId);

  if (escalated) {
    await service.from("adminos_automation_events").insert({
      event_type: "enquiry.escalated", entity_type: "enquiry_thread", entity_id: threadId, contact_id: contactId,
      payload: { reason: agent.reason, risk: agent.risk, confidence: agent.confidence, application_id: applicationId },
      correlation_id: `enquiry:${threadId}:escalated:${agent.run_id || Date.now()}`,
    });
  }

  return json({ response: agent.answer, thread_id: threadId, escalated, risk: agent.risk, confidence: agent.confidence, provider: agent.provider, model: agent.model, release: 2, phase: 4 });
});
