import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const fromNumber = env("TWILIO_WHATSAPP_FROM");
const canonicalWebhookUrl = env("TWILIO_WHATSAPP_WEBHOOK_URL");
const statusCallback = env("TWILIO_WHATSAPP_STATUS_CALLBACK_URL");

const digits = (value = "") => value.replace(/^whatsapp:/i, "").replace(/\D/g, "");
const e164 = (value = "") => {
  let d = digits(value);
  if (d.startsWith("0") && d.length === 10) d = `27${d.slice(1)}`;
  if (!d.startsWith("27") && d.length === 9) d = `27${d}`;
  return d ? `+${d}` : "";
};
const wa = (value = "") => { const n = e164(value); return n ? `whatsapp:${n}` : ""; };
const normalized = (value = "") => digits(e164(value));
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;
const xml = (body = "<Response></Response>", status = 200) => new Response(body, { status, headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" } });

async function hmacSha1Base64(keyText: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(keyText), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  let binary = "";
  for (const b of new Uint8Array(sig)) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function verifySignature(req: Request, params: URLSearchParams) {
  if (!authToken) return false;
  const received = req.headers.get("X-Twilio-Signature") || "";
  if (!received) return false;
  const url = canonicalWebhookUrl || req.url;
  const keys = Array.from(new Set(Array.from(params.keys()))).sort();
  let payload = url;
  for (const key of keys) for (const value of params.getAll(key)) payload += `${key}${value}`;
  const expected = await hmacSha1Base64(authToken, payload);
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function twilioFetchMessage(messageSid: string) {
  if (!accountSid || !authToken || !messageSid) throw new Error("Twilio verification unavailable");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${encodeURIComponent(messageSid)}.json`, { headers: { Authorization: basic() } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return data;
}

async function verifyViaTwilioRest(params: URLSearchParams) {
  try {
    const messageSid = params.get("MessageSid") || params.get("SmsSid") || "";
    const postedAccount = params.get("AccountSid") || "";
    if (!messageSid || !postedAccount || postedAccount !== accountSid) return false;
    const remote = await twilioFetchMessage(messageSid);
    if (remote?.sid !== messageSid || remote?.account_sid !== accountSid) return false;
    const postedFrom = params.get("From");
    const postedTo = params.get("To");
    const postedBody = params.get("Body");
    if (postedFrom && String(remote?.from || "") !== postedFrom) return false;
    if (postedTo && String(remote?.to || "") !== postedTo) return false;
    if (postedBody !== null && String(remote?.body || "") !== postedBody) return false;
    return true;
  } catch {
    return false;
  }
}

async function twilioSend(to: string, body: string) {
  if (!accountSid || !authToken || !fromNumber) throw new Error("Twilio WhatsApp secrets are not configured");
  const form = new URLSearchParams({ From: wa(fromNumber), To: wa(to), Body: body });
  if (statusCallback) form.set("StatusCallback", statusCallback);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return data;
}

async function conversationContext(service: any, threadId: string) {
  const { data } = await service
    .from("adminos_whatsapp_messages")
    .select("direction,body_text,created_at,metadata")
    .eq("thread_id", threadId)
    .not("body_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data || [])
    .reverse()
    .map((row: any) => `${row.direction === "inbound" ? "Customer" : row.metadata?.author_type === "ai" ? "ResKonnect AI" : "ResKonnect"}: ${String(row.body_text || "").slice(0, 1200)}`)
    .join("\n");
}

async function processInbound(service: any, input: { thread: any; contactId: string | null; from: string; body: string; messageId: string; authMode: string }) {
  const { thread, contactId, from, body, messageId, authMode } = input;
  try {
    if (!body.trim()) return;
    const prefs = contactId
      ? (await service.from("adminos_communication_preferences").select("do_not_contact,whatsapp_allowed").eq("contact_id", contactId).maybeSingle()).data
      : null;
    if (prefs?.do_not_contact || prefs?.whatsapp_allowed === false) return;

    const mode = thread.mode || "ai_auto";
    if (mode !== "ai_auto") {
      await service.from("adminos_automation_events").insert({
        event_type: "whatsapp.human_mode_waiting",
        entity_type: "whatsapp_thread",
        entity_id: thread.id,
        contact_id: contactId,
        payload: { message_id: messageId, mode, auth_mode: authMode },
      });
      return;
    }

    const history = await conversationContext(service, thread.id);
    const agentMessage = history
      ? `Use this recent WhatsApp conversation to understand the latest customer message and continue naturally. Do not repeat questions already answered.\n\n${history}\n\nLATEST CUSTOMER MESSAGE:\n${body}`
      : body;

    const agentResp = await fetch(`${supabaseUrl}/functions/v1/adminos-agent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "public_enquiry",
        message: agentMessage,
        contact_id: contactId,
        context: {
          channel: "whatsapp",
          verified_phone_contact: Boolean(contactId),
          whatsapp_thread_id: thread.id,
          current_user_message: body,
          conversation_history: history,
        },
      }),
    });
    const agent = await agentResp.json().catch(() => ({}));

    if (agentResp.ok && agent.answer && agent.risk === "green" && !agent.escalate) {
      const answer = String(agent.answer).slice(0, 1500);
      const sent = await twilioSend(from, answer);
      const sentAt = new Date().toISOString();
      await service.from("adminos_whatsapp_messages").upsert({
        thread_id: thread.id,
        contact_id: contactId,
        twilio_message_sid: sent.sid,
        direction: "outbound",
        from_address: wa(fromNumber),
        to_address: wa(from),
        body_text: answer,
        message_kind: "service",
        status: sent.status === "queued" ? "queued" : "sent",
        risk_level: "green",
        confidence: agent.confidence || null,
        agent_run_id: agent.run_id || null,
        sent_at: sentAt,
        metadata: { source: "whatsapp_auto_reply", author_type: "ai", auth_mode: authMode },
      }, { onConflict: "twilio_message_sid" });
      await service.from("adminos_whatsapp_threads").update({
        last_message_at: sentAt,
        last_outbound_at: sentAt,
        status: "waiting",
        mode: "ai_auto",
        last_summary: agent.summary || thread.last_summary || null,
        updated_at: sentAt,
      }).eq("id", thread.id);
      return;
    }

    const now = new Date().toISOString();
    await service.from("adminos_whatsapp_threads").update({ status: "escalated", mode: "escalated", updated_at: now }).eq("id", thread.id);
    await service.from("adminos_automation_events").insert({
      event_type: "whatsapp.escalated",
      entity_type: "whatsapp_thread",
      entity_id: thread.id,
      contact_id: contactId,
      payload: { reason: agent.reason || agent.error || "Agent escalation", risk: agent.risk || "amber", message_id: messageId },
    });
  } catch (error) {
    const now = new Date().toISOString();
    await service.from("adminos_whatsapp_threads").update({ status: "escalated", mode: "escalated", updated_at: now }).eq("id", thread.id);
    await service.from("adminos_automation_events").insert({
      event_type: "whatsapp.escalated",
      entity_type: "whatsapp_thread",
      entity_id: thread.id,
      contact_id: contactId,
      payload: { reason: error instanceof Error ? error.message : String(error), risk: "amber", message_id: messageId },
    });
  }
}

serve(async (req) => {
  if (req.method !== "POST") return xml("<Response></Response>", 405);
  if (!supabaseUrl || !serviceKey) return xml("<Response></Response>", 500);

  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const signatureVerified = await verifySignature(req, params);
  const restVerified = signatureVerified ? false : await verifyViaTwilioRest(params);
  if (!signatureVerified && !restVerified) return xml("<Response></Response>", 403);
  const authMode = signatureVerified ? "signature" : "rest_fallback";

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const sid = params.get("MessageSid") || params.get("SmsSid") || "";
  const status = params.get("MessageStatus") || params.get("SmsStatus") || "";
  const from = params.get("From") || "";
  const to = params.get("To") || "";
  const body = (params.get("Body") || "").slice(0, 12000);

  if (sid && status && !body.trim() && ["queued", "sent", "delivered", "read", "failed", "undelivered"].includes(status)) {
    const patch: any = { status };
    if (status === "delivered" || status === "read") patch.delivered_at = new Date().toISOString();
    await service.from("adminos_whatsapp_messages").update(patch).eq("twilio_message_sid", sid);
    await service.from("adminos_whatsapp_outbox").update({
      status: ["failed", "undelivered"].includes(status) ? "failed" : "sent",
      last_error: ["failed", "undelivered"].includes(status) ? (params.get("ErrorMessage") || params.get("ErrorCode") || status) : null,
    }).eq("twilio_message_sid", sid);
    return xml();
  }

  if (!sid || !from) return xml();
  const norm = normalized(from);
  if (!norm) return xml();

  const resolved = await service.rpc("adminos_resolve_contact", {
    p_full_name: params.get("ProfileName") || null,
    p_email: null,
    p_phone: e164(from),
    p_profile_user_id: null,
    p_source_type: "whatsapp",
    p_source_id: null,
    p_metadata: { source: "twilio_whatsapp_inbound", twilio_sid: sid },
  });
  const contactId = resolved.data || null;

  let thread = (await service.from("adminos_whatsapp_threads").select("*").eq("normalized_address", norm).maybeSingle()).data;
  if (!thread) {
    const created = await service.from("adminos_whatsapp_threads").insert({
      contact_id: contactId,
      channel_address: wa(from),
      normalized_address: norm,
      status: "open",
      mode: "ai_auto",
      metadata: { source: "twilio" },
    }).select("*").single();
    thread = created.data;
  }
  if (!thread) return xml();

  const mediaCount = Math.max(0, Math.min(10, Number(params.get("NumMedia") || 0)));
  const media: any[] = [];
  for (let i = 0; i < mediaCount; i++) media.push({ url: params.get(`MediaUrl${i}`), content_type: params.get(`MediaContentType${i}`) });
  const now = new Date();
  const nowIso = now.toISOString();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const inserted = await service.from("adminos_whatsapp_messages").upsert({
    thread_id: thread.id,
    contact_id: contactId,
    twilio_message_sid: sid,
    direction: "inbound",
    from_address: wa(from),
    to_address: wa(to),
    body_text: body || null,
    media,
    message_kind: "service",
    status: "received",
    received_at: nowIso,
    metadata: { account_sid: params.get("AccountSid"), profile_name: params.get("ProfileName") || null, author_type: "contact", auth_mode: authMode },
  }, { onConflict: "twilio_message_sid" }).select("id").maybeSingle();

  const reopenedMode = thread.mode === "closed" ? "ai_auto" : (thread.mode || "ai_auto");
  await service.from("adminos_whatsapp_threads").update({
    contact_id: contactId || thread.contact_id,
    last_message_at: nowIso,
    last_inbound_at: nowIso,
    customer_window_expires_at: expires,
    unread_count: Number(thread.unread_count || 0) + (inserted.data ? 1 : 0),
    status: "open",
    mode: reopenedMode,
    updated_at: nowIso,
  }).eq("id", thread.id);

  if (!inserted.data) return xml();
  await service.from("adminos_automation_events").insert({
    event_type: "whatsapp.received",
    entity_type: "whatsapp_thread",
    entity_id: thread.id,
    contact_id: contactId,
    payload: { message_id: inserted.data.id, message_sid: sid, body: body.slice(0, 1000), auth_mode: authMode },
  });

  EdgeRuntime.waitUntil(processInbound(service, { thread: { ...thread, mode: reopenedMode }, contactId, from, body, messageId: inserted.data.id, authMode }));
  return xml();
});