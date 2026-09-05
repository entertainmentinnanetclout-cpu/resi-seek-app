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

const digits = (value = "") => value.replace(/^whatsapp:/i, "").replace(/\D/g, "");
const e164 = (value = "") => {
  let d = digits(value);
  if (d.startsWith("0") && d.length === 10) d = `27${d.slice(1)}`;
  if (!d.startsWith("27") && d.length === 9) d = `27${d}`;
  return d ? `+${d}` : "";
};
const wa = (value = "") => { const number = e164(value); return number ? `whatsapp:${number}` : ""; };
const normalized = (value = "") => digits(e164(value));
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;

async function twilioRequest(path: string, method = "GET", form?: URLSearchParams) {
  if (!accountSid || !authToken) throw new Error("Twilio WhatsApp secrets are not configured");
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/${path}`, {
    method,
    headers: { Authorization: basic(), ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `Twilio HTTP ${r.status}`);
  return data;
}

async function checkPermission(service: any, contactId: string | null, kind: string) {
  if (!contactId) return { allowed: true, reason: "no_contact_record" };
  const { data: prefs } = await service.from("adminos_communication_preferences").select("*").eq("contact_id", contactId).maybeSingle();
  if (prefs?.do_not_contact) return { allowed: false, reason: "do_not_contact" };
  if (prefs && prefs.whatsapp_allowed === false) return { allowed: false, reason: "whatsapp_disabled" };
  if (kind === "marketing") {
    if (!prefs?.marketing_allowed) return { allowed: false, reason: "marketing_not_allowed" };
    const { data: consent } = await service.from("adminos_consents").select("id").eq("contact_id", contactId).eq("status", "granted").eq("channel", "whatsapp").in("purpose", ["marketing", "direct_marketing"]).limit(1).maybeSingle();
    if (!consent) return { allowed: false, reason: "marketing_consent_missing" };
  }
  return { allowed: true, reason: "allowed" };
}

async function ensureThread(service: any, address: string, contactId: string | null) {
  const norm = normalized(address);
  if (!norm) throw new Error("Valid WhatsApp destination is required");
  const existing = await service.from("adminos_whatsapp_threads").select("*").eq("normalized_address", norm).maybeSingle();
  if (existing.data) {
    if (contactId && !existing.data.contact_id) await service.from("adminos_whatsapp_threads").update({ contact_id: contactId }).eq("id", existing.data.id);
    return { ...existing.data, contact_id: existing.data.contact_id || contactId };
  }
  const created = await service.from("adminos_whatsapp_threads").insert({ contact_id: contactId, channel_address: wa(address), normalized_address: norm, status: "open", metadata: { source: "adminos_whatsapp" } }).select("*").single();
  if (created.error) throw created.error;
  return created.data;
}

async function sendItem(service: any, item: any) {
  const permission = await checkPermission(service, item.contact_id, item.message_kind || "transactional");
  if (!permission.allowed) {
    await service.from("adminos_whatsapp_outbox").update({ status: "blocked", last_error: permission.reason }).eq("id", item.id);
    return { id: item.id, status: "blocked", reason: permission.reason };
  }
  const thread = item.thread_id ? (await service.from("adminos_whatsapp_threads").select("*").eq("id", item.thread_id).maybeSingle()).data : await ensureThread(service, item.to_address, item.contact_id);
  const windowOpen = !!thread?.customer_window_expires_at && new Date(thread.customer_window_expires_at).getTime() > Date.now();
  if (!windowOpen && !item.template_sid) {
    await service.from("adminos_whatsapp_outbox").update({ status: "blocked", last_error: "Approved WhatsApp template required outside the 24-hour customer-service window" }).eq("id", item.id);
    return { id: item.id, status: "blocked", reason: "template_required" };
  }
  const form = new URLSearchParams();
  form.set("From", wa(fromNumber));
  form.set("To", wa(item.to_address));
  if (item.template_sid) {
    form.set("ContentSid", item.template_sid);
    if (item.template_vars && Object.keys(item.template_vars).length) form.set("ContentVariables", JSON.stringify(item.template_vars));
  } else form.set("Body", String(item.body_text || ""));
  if (statusCallback) form.set("StatusCallback", statusCallback);
  await service.from("adminos_whatsapp_outbox").update({ status: "sending", attempts: Number(item.attempts || 0) + 1, last_error: null }).eq("id", item.id);
  try {
    const sent = await twilioRequest("Messages.json", "POST", form);
    const now = new Date().toISOString();
    await service.from("adminos_whatsapp_outbox").update({ status: "sent", twilio_message_sid: sent.sid, sent_at: now, last_error: null }).eq("id", item.id);
    await service.from("adminos_whatsapp_messages").upsert({ thread_id: thread.id, contact_id: item.contact_id, twilio_message_sid: sent.sid, direction: "outbound", from_address: wa(fromNumber), to_address: wa(item.to_address), body_text: item.body_text || null, message_kind: item.message_kind || "transactional", status: sent.status === "queued" ? "queued" : "sent", risk_level: item.risk_level, confidence: item.confidence, agent_run_id: item.agent_run_id, sent_at: now, metadata: { source: "adminos_outbox", outbox_id: item.id, template_sid: item.template_sid || null } }, { onConflict: "twilio_message_sid" });
    await service.from("adminos_whatsapp_threads").update({ last_message_at: now, status: "waiting" }).eq("id", thread.id);
    return { id: item.id, status: "sent", sid: sent.sid };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await service.from("adminos_whatsapp_outbox").update({ status: "failed", last_error: message }).eq("id", item.id);
    throw e;
  }
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
  const configured = Boolean(accountSid && authToken && fromNumber);
  if (action === "health") return json({ ok: configured, configured, provider: "twilio", release: 3, phase: 6 });
  if (action === "test") {
    try {
      const account = await twilioRequest(".json");
      await service.from("adminos_integration_connections").update({ status: "connected", enabled: true, setup_step: 3, external_account_label: account.friendly_name || accountSid, last_tested_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null }).eq("provider", "twilio_whatsapp");
      return json({ ok: true, account_sid: account.sid, account_status: account.status, from: wa(fromNumber) });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await service.from("adminos_integration_connections").update({ status: configured ? "error" : "needs_action", enabled: false, setup_step: 2, last_tested_at: new Date().toISOString(), last_error_at: new Date().toISOString(), last_error: message }).eq("provider", "twilio_whatsapp");
      return json({ error: message, setup_required: !configured }, 503);
    }
  }
  if (action === "queue") {
    const contactId = body.contact_id ? String(body.contact_id) : null;
    let toAddress = String(body.to_address || "");
    if (!toAddress && contactId) {
      const c = await service.from("adminos_contacts").select("phone").eq("id", contactId).maybeSingle();
      toAddress = c.data?.phone || "";
    }
    if (!e164(toAddress)) return json({ error: "Valid destination phone is required" }, 400);
    const kind = ["transactional","service","marketing"].includes(body.message_kind) ? body.message_kind : "transactional";
    const risk = ["green","amber","red"].includes(body.risk_level) ? body.risk_level : "green";
    const permission = await checkPermission(service, contactId, kind);
    if (!permission.allowed) return json({ error: `Contact blocked: ${permission.reason}` }, 409);
    const thread = await ensureThread(service, toAddress, contactId);
    const idempotency = String(body.idempotency_key || `whatsapp:${contactId || normalized(toAddress)}:${crypto.randomUUID()}`);
    let approvalId: string | null = null;
    let status = "queued";
    if (risk !== "green") {
      const approval = await service.from("adminos_approval_requests").insert({ request_type: "whatsapp_reply", title: `Approve ${risk}-risk WhatsApp message`, summary: String(body.body_text || "WhatsApp template message").slice(0, 400), entity_type: "whatsapp_thread", entity_id: thread.id, requested_action: { channel: "whatsapp", to: wa(toAddress), message_kind: kind }, risk_level: risk, requested_by_type: "agent" }).select("id").single();
      if (approval.error) throw approval.error;
      approvalId = approval.data.id; status = "awaiting_approval";
    }
    const inserted = await service.from("adminos_whatsapp_outbox").insert({ contact_id: contactId, thread_id: thread.id, source_type: body.source_type || "manual", source_id: body.source_id || null, to_address: e164(toAddress), body_text: body.body_text || null, message_kind: kind, template_sid: body.template_sid || null, template_vars: body.template_vars || {}, risk_level: risk, confidence: body.confidence ?? null, status, approval_id: approvalId, agent_run_id: body.agent_run_id || null, idempotency_key: idempotency, send_after: body.send_after || new Date().toISOString(), metadata: body.metadata || {} }).select("*").single();
    if (inserted.error) return json({ error: inserted.error.message }, 409);
    return json({ ok: true, outbox: inserted.data, approval_id: approvalId });
  }
  if (action === "send_outbox") {
    const id = String(body.outbox_id || "");
    if (!id) return json({ error: "outbox_id is required" }, 400);
    const item = await service.from("adminos_whatsapp_outbox").select("*").eq("id", id).maybeSingle();
    if (!item.data) return json({ error: "Outbox item not found" }, 404);
    if (item.data.status === "awaiting_approval") return json({ error: "Human approval required" }, 409);
    if (!["queued","draft","failed"].includes(item.data.status)) return json({ error: `Outbox item is ${item.data.status}` }, 409);
    if (!configured) return json({ error: "Twilio WhatsApp is not configured", setup_required: true }, 503);
    try { return json({ ok: true, result: await sendItem(service, item.data) }); }
    catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 502); }
  }
  if (action === "flush") {
    if (!configured) return json({ error: "Twilio WhatsApp is not configured", setup_required: true }, 503);
    const max = Math.max(1, Math.min(50, Number(body.max || 20)));
    const due = await service.from("adminos_whatsapp_outbox").select("*").in("status", ["queued","draft","failed"]).lte("send_after", new Date().toISOString()).order("send_after", { ascending: true }).limit(max);
    let sent = 0, blocked = 0, failed = 0;
    const results: any[] = [];
    for (const item of due.data || []) {
      try { const result = await sendItem(service, item); results.push(result); if (result.status === "sent") sent++; else if (result.status === "blocked") blocked++; }
      catch (e) { failed++; results.push({ id: item.id, status: "failed", error: e instanceof Error ? e.message : String(e) }); }
    }
    return json({ ok: true, processed: results.length, sent, blocked, failed, results });
  }
  return json({ error: "Unsupported action" }, 400);
});
