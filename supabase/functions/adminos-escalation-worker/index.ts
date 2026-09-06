import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const fromNumber = env("TWILIO_WHATSAPP_FROM");
const statusCallback = env("TWILIO_WHATSAPP_STATUS_CALLBACK_URL");
const CONTENT_KEY = "rk_internal_escalation_alert_v1";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const digits = (value = "") => String(value).replace(/^whatsapp:/i, "").replace(/\D/g, "");
const e164 = (value = "") => {
  let d = digits(value);
  if (d.startsWith("0") && d.length === 10) d = `27${d.slice(1)}`;
  if (!d.startsWith("27") && d.length === 9) d = `27${d}`;
  return d ? `+${d}` : "";
};
const wa = (value = "") => {
  const n = e164(value);
  return n ? `whatsapp:${n}` : "";
};
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;

async function authorized(req: Request, service: any) {
  const token = req.headers.get("x-adminos-cron-token") || "";
  if (!token) return false;
  const row = await service.from("adminos_scheduler_secrets")
    .select("secret_value")
    .eq("secret_key", "escalation_alert_worker")
    .maybeSingle();
  const expected = String(row.data?.secret_value || "");
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function twilioSend(form: URLSearchParams) {
  if (!accountSid || !authToken || !fromNumber) throw new Error("Twilio WhatsApp is not configured");
  if (statusCallback) form.set("StatusCallback", statusCallback);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: basic(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return data;
}

async function recipientWindowOpen(service: any, recipient: string) {
  const normalized = digits(e164(recipient));
  if (!normalized) return false;
  const row = await service.from("adminos_whatsapp_threads")
    .select("customer_window_expires_at")
    .eq("normalized_address", normalized)
    .maybeSingle();
  const expires = row.data?.customer_window_expires_at;
  return Boolean(expires && new Date(expires).getTime() > Date.now());
}

async function sendAlert(service: any, alert: any, template: any) {
  const recipient = e164(alert.recipient_number);
  if (!recipient) throw new Error("Invalid escalation recipient number");

  const reason = String(alert.reason || "Human assistance requested on WhatsApp").slice(0, 300);
  const customer = String(alert.customer_label || "WhatsApp customer").slice(0, 120);
  const openWindow = await recipientWindowOpen(service, recipient);

  let sent: any;
  let deliveryMode: "session_text" | "approved_template";

  if (openWindow) {
    const body = `ResKonnect escalation alert. ${customer} needs human attention. Reason: ${reason}. Open AdminOS: https://www.reskonnect.org/admin/system?tab=communications`;
    sent = await twilioSend(new URLSearchParams({
      From: wa(fromNumber),
      To: wa(recipient),
      Body: body.slice(0, 1500),
    }));
    deliveryMode = "session_text";
  } else {
    if (!template?.content_sid) return { waiting: true, reason: "escalation_template_not_created" };
    if (template.status !== "approved") return { waiting: true, reason: `escalation_template_${template.status || "not_ready"}` };
    sent = await twilioSend(new URLSearchParams({
      From: wa(fromNumber),
      To: wa(recipient),
      ContentSid: template.content_sid,
      ContentVariables: JSON.stringify({ "1": customer, "2": reason }),
    }));
    deliveryMode = "approved_template";
  }

  await service.from("adminos_automation_events").insert({
    event_type: "whatsapp.executive_escalation_alert_sent",
    entity_type: "whatsapp_thread",
    entity_id: alert.thread_id,
    contact_id: alert.contact_id,
    payload: {
      recipient_number: recipient,
      twilio_message_sid: sent.sid,
      delivery_mode: deliveryMode,
      persona: "Dimpho",
      alert_id: alert.id,
    },
  });

  return { waiting: false, sent, deliveryMode };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase runtime is not configured" }, 500);

  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!(await authorized(req, service))) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  if (String(body.action || "tick") !== "tick") return json({ error: "Unsupported action" }, 400);

  const template = (await service.from("adminos_whatsapp_rich_content")
    .select("content_key,content_sid,status,approval_required")
    .eq("content_key", CONTENT_KEY)
    .maybeSingle()).data;

  const due = await service.from("adminos_escalation_alerts")
    .select("*")
    .in("status", ["pending", "waiting_template", "failed"])
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(40);

  const results: any[] = [];
  for (const alert of due.data || []) {
    const attempts = Number(alert.attempts || 0) + 1;
    await service.from("adminos_escalation_alerts")
      .update({ status: "processing", attempts, updated_at: new Date().toISOString() })
      .eq("id", alert.id);

    try {
      const result = await sendAlert(service, alert, template);
      if (result.waiting) {
        await service.from("adminos_escalation_alerts").update({
          status: "waiting_template",
          available_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          last_error: result.reason,
          updated_at: new Date().toISOString(),
        }).eq("id", alert.id);
        results.push({ id: alert.id, status: "waiting_template", reason: result.reason });
        continue;
      }

      await service.from("adminos_escalation_alerts").update({
        status: "sent",
        twilio_message_sid: result.sent.sid,
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", alert.id);
      results.push({ id: alert.id, status: "sent", delivery_mode: result.deliveryMode });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const blocked = attempts >= 6;
      await service.from("adminos_escalation_alerts").update({
        status: blocked ? "blocked" : "failed",
        available_at: new Date(Date.now() + Math.min(60, attempts * 5) * 60 * 1000).toISOString(),
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", alert.id);
      results.push({ id: alert.id, status: blocked ? "blocked" : "failed", error: message });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
