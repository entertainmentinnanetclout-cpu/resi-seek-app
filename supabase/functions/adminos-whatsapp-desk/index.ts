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
const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const fromNumber = env("TWILIO_WHATSAPP_FROM");
const statusCallback = env("TWILIO_WHATSAPP_STATUS_CALLBACK_URL");
const mediaBucket = "adminos-whatsapp-media";

const digits = (value = "") => String(value).replace(/^whatsapp:/i, "").replace(/\D/g, "");
const e164 = (value = "") => {
  let d = digits(value);
  if (d.startsWith("0") && d.length === 10) d = `27${d.slice(1)}`;
  if (!d.startsWith("27") && d.length === 9) d = `27${d}`;
  return d ? `+${d}` : "";
};
const wa = (value = "") => { const n = e164(value); return n ? `whatsapp:${n}` : ""; };
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;

async function twilioSend(form: URLSearchParams) {
  if (!accountSid || !authToken || !fromNumber) throw new Error("Twilio WhatsApp is not configured");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return data;
}

async function addActivity(service: any, threadId: string, actorId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  await service.from("adminos_whatsapp_activity").insert({ thread_id: threadId, actor_id: actorId, event_type: eventType, metadata });
}

async function getThread(service: any, threadId: string) {
  const result = await service.from("adminos_whatsapp_threads").select("*").eq("id", threadId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("WhatsApp conversation not found");
  return result.data;
}

async function getContact(service: any, contactId: string | null) {
  if (!contactId) return null;
  const result = await service.from("adminos_contacts").select("*").eq("id", contactId).maybeSingle();
  return result.data || null;
}

async function recentHistory(service: any, threadId: string, limit = 24) {
  const result = await service.from("adminos_whatsapp_messages")
    .select("id,direction,body_text,status,risk_level,confidence,metadata,created_at,received_at,sent_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (result.data || []).reverse();
}

async function invokeAgent(authHeader: string, action: string, message: string, thread: any, contact: any, history: any[], extra: Record<string, unknown> = {}) {
  const response = await fetch(`${supabaseUrl}/functions/v1/adminos-agent`, {
    method: "POST",
    headers: { Authorization: authHeader, apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      contact_id: contact?.id || null,
      message,
      context: {
        channel: "whatsapp",
        thread: { id: thread.id, mode: thread.mode, status: thread.status, priority: thread.priority, last_summary: thread.last_summary },
        contact: contact ? { full_name: contact.full_name, email: contact.email, phone: contact.phone, student_number: contact.student_number, campus: contact.campus, contact_type: contact.contact_type } : null,
        conversation_history: history.map((row) => ({ direction: row.direction, body: row.body_text, author_type: row.metadata?.author_type || null, at: row.sent_at || row.received_at || row.created_at })),
        ...extra,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || `AI service HTTP ${response.status}`);
  return data;
}

async function signedMediaUrl(service: any, path: string) {
  if (!path) return null;
  const result = await service.storage.from(mediaBucket).createSignedUrl(path, 900);
  if (result.error) throw result.error;
  return result.data?.signedUrl || null;
}

async function sendMessage(service: any, userId: string, thread: any, input: any) {
  const now = new Date().toISOString();
  const windowOpen = Boolean(thread.customer_window_expires_at && new Date(thread.customer_window_expires_at).getTime() > Date.now());
  const bodyText = String(input.body_text || "").trim().slice(0, 4000);
  const templateKey = input.template_key ? String(input.template_key) : "";
  const mediaPath = input.media_path ? String(input.media_path) : "";
  const form = new URLSearchParams({ From: wa(fromNumber), To: wa(thread.channel_address) });
  let template: any = null;
  let media: any[] = [];

  if (templateKey) {
    const result = await service.from("adminos_whatsapp_templates").select("*").eq("template_key", templateKey).maybeSingle();
    template = result.data;
    if (!template || template.status !== "approved" || !template.content_sid) throw new Error("This WhatsApp template is not approved yet");
    form.set("ContentSid", template.content_sid);
    const names = Array.isArray(template.variables) ? template.variables : [];
    const supplied = input.template_vars && typeof input.template_vars === "object" ? input.template_vars : {};
    const numbered: Record<string, string> = {};
    names.forEach((name: string, index: number) => { numbered[String(index + 1)] = String(supplied[name] ?? supplied[String(index + 1)] ?? ""); });
    if (Object.keys(numbered).length) form.set("ContentVariables", JSON.stringify(numbered));
  } else {
    if (!windowOpen) throw new Error("The 24-hour service window is closed. Send an approved template instead.");
    if (!bodyText && !mediaPath) throw new Error("Type a message or attach a file");
    if (bodyText) form.set("Body", bodyText);
    if (mediaPath) {
      const url = await signedMediaUrl(service, mediaPath);
      if (!url) throw new Error("Could not prepare attachment");
      form.set("MediaUrl", url);
      media = [{ storage_bucket: mediaBucket, storage_path: mediaPath, content_type: input.media_type || null, name: input.media_name || null }];
    }
  }
  if (statusCallback) form.set("StatusCallback", statusCallback);

  const sent = await twilioSend(form);
  const displayBody = template ? (bodyText || template.preview_text || null) : (bodyText || null);
  const message = await service.from("adminos_whatsapp_messages").upsert({
    thread_id: thread.id,
    contact_id: thread.contact_id,
    twilio_message_sid: sent.sid,
    direction: "outbound",
    from_address: wa(fromNumber),
    to_address: wa(thread.channel_address),
    body_text: displayBody,
    media,
    message_kind: template?.message_kind || "service",
    status: sent.status === "queued" ? "queued" : "sent",
    risk_level: "green",
    sent_at: now,
    metadata: { source: "adminos_whatsapp_desk", author_type: "human", author_id: userId, template_key: template?.template_key || null, content_sid: template?.content_sid || null },
  }, { onConflict: "twilio_message_sid" }).select("*").single();
  if (message.error) throw message.error;

  await service.from("adminos_whatsapp_threads").update({
    last_message_at: now,
    last_outbound_at: now,
    status: "waiting",
    mode: "human",
    takeover_at: thread.mode === "human" ? thread.takeover_at : now,
    takeover_by: userId,
    updated_at: now,
  }).eq("id", thread.id);

  if (input.draft_id) await service.from("adminos_whatsapp_drafts").update({ status: "sent", updated_at: now }).eq("id", String(input.draft_id)).eq("thread_id", thread.id);
  await addActivity(service, thread.id, userId, template ? "template.sent" : mediaPath ? "message.media_sent" : "message.sent", { message_id: message.data.id, twilio_message_sid: sent.sid, template_key: template?.template_key || null, media_path: mediaPath || null });
  return { message: message.data, twilio_status: sent.status, window_open: windowOpen };
}

function computeAnalytics(threads: any[], messages: any[]) {
  const outbound = messages.filter((m) => m.direction === "outbound");
  const inbound = messages.filter((m) => m.direction === "inbound");
  const aiOutbound = outbound.filter((m) => m.metadata?.author_type === "ai" || m.metadata?.source === "whatsapp_auto_reply");
  const humanOutbound = outbound.filter((m) => m.metadata?.author_type === "human" || m.metadata?.source === "adminos_whatsapp_desk");
  const successful = outbound.filter((m) => ["delivered", "read"].includes(String(m.status)));
  const failed = outbound.filter((m) => ["failed", "undelivered"].includes(String(m.status)));
  const responseSeconds: number[] = [];
  const byThread = new Map<string, any[]>();
  for (const message of messages) {
    const list = byThread.get(message.thread_id) || [];
    list.push(message); byThread.set(message.thread_id, list);
  }
  for (const list of byThread.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const firstInbound = list.find((m) => m.direction === "inbound");
    if (!firstInbound) continue;
    const start = new Date(firstInbound.received_at || firstInbound.created_at).getTime();
    const firstOutbound = list.find((m) => m.direction === "outbound" && new Date(m.sent_at || m.created_at).getTime() >= start);
    if (firstOutbound) responseSeconds.push(Math.max(0, (new Date(firstOutbound.sent_at || firstOutbound.created_at).getTime() - start) / 1000));
  }
  const daily: any[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - i);
    const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1);
    const rows = messages.filter((m) => { const t = new Date(m.created_at).getTime(); return t >= d.getTime() && t < next.getTime(); });
    daily.push({ date: d.toISOString().slice(0, 10), inbound: rows.filter((m) => m.direction === "inbound").length, outbound: rows.filter((m) => m.direction === "outbound").length });
  }
  return {
    totals: {
      conversations: threads.length,
      open: threads.filter((t) => !["resolved", "archived"].includes(t.status)).length,
      ai_auto: threads.filter((t) => (t.mode || "ai_auto") === "ai_auto").length,
      assist: threads.filter((t) => t.mode === "assist").length,
      human: threads.filter((t) => t.mode === "human").length,
      escalated: threads.filter((t) => t.mode === "escalated" || t.status === "escalated").length,
      service_windows_open: threads.filter((t) => t.customer_window_expires_at && new Date(t.customer_window_expires_at).getTime() > Date.now()).length,
      inbound: inbound.length,
      outbound: outbound.length,
      ai_outbound: aiOutbound.length,
      human_outbound: humanOutbound.length,
      successful: successful.length,
      failed: failed.length,
    },
    automation_share: outbound.length ? aiOutbound.length / outbound.length : 0,
    delivery_rate: outbound.length ? successful.length / outbound.length : 0,
    average_first_response_seconds: responseSeconds.length ? Math.round(responseSeconds.reduce((a, b) => a + b, 0) / responseSeconds.length) : null,
    daily,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase runtime is not configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData } = await authClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Authentication required" }, 401);
  const { data: staffRole } = await service.rpc("get_user_staff_role", { _user_id: user.id });
  if (!staffRole) return json({ error: "Staff access required" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "health");
  if (action === "health") return json({ ok: Boolean(accountSid && authToken && fromNumber), phase: 5, release: "whatsapp_desk", capabilities: ["manual_send", "media", "templates", "notes", "assignment", "ai_draft", "ai_summary", "assist", "analytics"] });

  try {
    if (action === "staff") {
      const result = await service.from("profiles").select("id,full_name,email,role,profile_picture_url").in("role", ["admin", "super_admin", "developer", "office_admin"]).order("full_name");
      return json({ ok: true, staff: result.data || [] });
    }

    if (action === "analytics") {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [threadRes, messageRes] = await Promise.all([
        service.from("adminos_whatsapp_threads").select("id,status,mode,customer_window_expires_at,assigned_to,created_at,last_message_at"),
        service.from("adminos_whatsapp_messages").select("thread_id,direction,status,metadata,created_at,received_at,sent_at").gte("created_at", since).order("created_at", { ascending: true }).limit(5000),
      ]);
      return json({ ok: true, analytics: computeAnalytics(threadRes.data || [], messageRes.data || []) });
    }

    const threadId = String(body.thread_id || "");
    if (!threadId) return json({ error: "thread_id is required" }, 400);
    const thread = await getThread(service, threadId);

    if (action === "send") return json({ ok: true, ...(await sendMessage(service, user.id, thread, body)) });

    if (action === "note") {
      const noteBody = String(body.body || "").trim().slice(0, 4000);
      if (!noteBody) return json({ error: "Note is required" }, 400);
      const result = await service.from("adminos_whatsapp_notes").insert({ thread_id: threadId, author_id: user.id, body: noteBody, metadata: { source: "whatsapp_desk" } }).select("*").single();
      if (result.error) throw result.error;
      await addActivity(service, threadId, user.id, "note.added", { note_id: result.data.id });
      return json({ ok: true, note: result.data });
    }

    if (action === "assign") {
      const assignee = body.assigned_to ? String(body.assigned_to) : null;
      if (assignee) {
        const role = await service.rpc("get_user_staff_role", { _user_id: assignee });
        if (!role.data) return json({ error: "Assignee is not an AdminOS staff member" }, 400);
      }
      const now = new Date().toISOString();
      await service.from("adminos_whatsapp_threads").update({ assigned_to: assignee, updated_at: now }).eq("id", threadId);
      await addActivity(service, threadId, user.id, "assignment.changed", { assigned_to: assignee });
      return json({ ok: true, assigned_to: assignee });
    }

    if (action === "set_mode") {
      const mode = String(body.mode || "");
      if (!["ai_auto", "assist", "human", "escalated", "closed"].includes(mode)) return json({ error: "Invalid mode" }, 400);
      const now = new Date().toISOString();
      const patch: any = { mode, updated_at: now };
      if (mode === "escalated") patch.status = "escalated";
      else if (mode === "closed") { patch.status = "resolved"; patch.resolved_at = now; patch.resolved_by = user.id; }
      else { patch.status = thread.status === "resolved" ? "open" : thread.status === "escalated" ? "open" : thread.status; patch.resolved_at = null; patch.resolved_by = null; }
      if (["human", "assist"].includes(mode) && thread.mode !== mode) { patch.takeover_at = now; patch.takeover_by = user.id; }
      await service.from("adminos_whatsapp_threads").update(patch).eq("id", threadId);
      await addActivity(service, threadId, user.id, "mode.changed", { from: thread.mode, to: mode });
      return json({ ok: true, mode });
    }

    if (action === "thread_state") {
      const patch: any = { updated_at: new Date().toISOString() };
      if (body.priority !== undefined) {
        const priority = String(body.priority);
        if (!["low", "normal", "high", "urgent"].includes(priority)) return json({ error: "Invalid priority" }, 400);
        patch.priority = priority;
      }
      if (body.is_pinned !== undefined) patch.is_pinned = Boolean(body.is_pinned);
      if (Array.isArray(body.tags)) patch.tags = body.tags.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 12);
      await service.from("adminos_whatsapp_threads").update(patch).eq("id", threadId);
      await addActivity(service, threadId, user.id, "thread.updated", patch);
      return json({ ok: true, patch });
    }

    if (action === "resolve") {
      const now = new Date().toISOString();
      await service.from("adminos_whatsapp_threads").update({ status: "resolved", mode: "closed", resolved_at: now, resolved_by: user.id, unread_count: 0, updated_at: now }).eq("id", threadId);
      await addActivity(service, threadId, user.id, "thread.resolved");
      return json({ ok: true });
    }

    if (action === "reopen") {
      const mode = ["ai_auto", "assist", "human"].includes(String(body.mode)) ? String(body.mode) : "human";
      const now = new Date().toISOString();
      await service.from("adminos_whatsapp_threads").update({ status: "open", mode, resolved_at: null, resolved_by: null, updated_at: now }).eq("id", threadId);
      await addActivity(service, threadId, user.id, "thread.reopened", { mode });
      return json({ ok: true, mode });
    }

    if (action === "escalate") {
      const now = new Date().toISOString();
      await service.from("adminos_whatsapp_threads").update({ status: "escalated", mode: "escalated", priority: thread.priority === "urgent" ? "urgent" : "high", updated_at: now }).eq("id", threadId);
      await addActivity(service, threadId, user.id, "thread.escalated", { reason: String(body.reason || "Manual escalation").slice(0, 500) });
      return json({ ok: true });
    }

    if (action === "dismiss_draft") {
      const draftId = String(body.draft_id || "");
      if (!draftId) return json({ error: "draft_id is required" }, 400);
      await service.from("adminos_whatsapp_drafts").update({ status: "dismissed", updated_at: new Date().toISOString() }).eq("id", draftId).eq("thread_id", threadId);
      await addActivity(service, threadId, user.id, "ai_draft.dismissed", { draft_id: draftId });
      return json({ ok: true });
    }

    if (action === "ai_draft") {
      const history = await recentHistory(service, threadId, 24);
      const contact = await getContact(service, thread.contact_id);
      const instruction = String(body.instruction || "Draft the best concise WhatsApp reply to the latest customer message. Use the full conversation history so short answers are interpreted in context. Do not invent facts. Return a send-ready reply only in the answer field.");
      const agent = await invokeAgent(authHeader, "whatsapp_draft", instruction, thread, contact, history, { operator_mode: "assist" });
      const text = String(agent.answer || "").trim().slice(0, 4000);
      if (!text) throw new Error("AI did not return a draft");
      await service.from("adminos_whatsapp_drafts").update({ status: "superseded", updated_at: new Date().toISOString() }).eq("thread_id", threadId).eq("status", "ready");
      const latestInbound = [...history].reverse().find((m) => m.direction === "inbound");
      const result = await service.from("adminos_whatsapp_drafts").insert({ thread_id: threadId, source_message_id: latestInbound?.id || null, body_text: text, status: "ready", risk_level: agent.risk || "green", confidence: agent.confidence ?? null, agent_run_id: agent.run_id || null, created_by: user.id, metadata: { source: "manual_ai_draft", reason: agent.reason || null } }).select("*").single();
      if (result.error) throw result.error;
      await addActivity(service, threadId, user.id, "ai_draft.created", { draft_id: result.data.id, risk: agent.risk, confidence: agent.confidence });
      return json({ ok: true, draft: result.data });
    }

    if (action === "ai_summary") {
      const history = await recentHistory(service, threadId, 40);
      const contact = await getContact(service, thread.contact_id);
      const agent = await invokeAgent(authHeader, "whatsapp_summary", "Summarize this WhatsApp conversation for a ResKonnect staff member in 2-4 concise sentences. State the customer's intent, key facts already provided, what is still missing, and the best next action. Do not invent information.", thread, contact, history, { purpose: "staff_summary" });
      const summary = String(agent.answer || "").trim().slice(0, 2000);
      if (!summary) throw new Error("AI did not return a summary");
      await service.from("adminos_whatsapp_threads").update({ last_summary: summary, updated_at: new Date().toISOString() }).eq("id", threadId);
      await addActivity(service, threadId, user.id, "ai_summary.updated", { run_id: agent.run_id || null });
      return json({ ok: true, summary, confidence: agent.confidence, risk: agent.risk });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
