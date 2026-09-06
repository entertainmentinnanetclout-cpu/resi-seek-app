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
const preferredFrom = env("TWILIO_WHATSAPP_FROM");
const webhookUrl = env("TWILIO_WHATSAPP_WEBHOOK_URL") || `${supabaseUrl}/functions/v1/adminos-whatsapp-webhook`;
const statusCallbackUrl = env("TWILIO_WHATSAPP_STATUS_CALLBACK_URL") || webhookUrl;
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;

const digits = (value = "") => String(value).replace(/^whatsapp:/i, "").replace(/\D/g, "");
const normalizeWa = (value = "") => {
  const d = digits(value);
  return d ? `whatsapp:+${d}` : "";
};

async function twilioJson(url: string, options: RequestInit = {}) {
  if (!accountSid || !authToken) throw new Error("Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to Supabase Edge Function secrets first.");
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: basic(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.detail || data?.error?.message || `Twilio HTTP ${response.status}`);
  return data;
}

async function listWhatsAppSenders() {
  const data = await twilioJson("https://messaging.twilio.com/v2/Channels/Senders?Channel=whatsapp&PageSize=100");
  return Array.isArray(data?.senders) ? data.senders : [];
}

function pickSender(senders: any[]) {
  if (!senders.length) throw new Error("No Twilio WhatsApp sender was found on this account.");
  const preferred = normalizeWa(preferredFrom);
  if (preferred) {
    const exact = senders.find((s) => normalizeWa(s.sender_id || s.senderId) === preferred);
    if (exact) return exact;
  }
  const online = senders.filter((s) => String(s.status || "").toUpperCase() === "ONLINE");
  if (online.length === 1) return online[0];
  if (senders.length === 1) return senders[0];
  throw new Error(`Multiple WhatsApp senders were found (${senders.length}). Set TWILIO_WHATSAPP_FROM once to select the production sender.`);
}

async function configureSenderWebhook(sender: any) {
  const sid = String(sender.sid || "");
  if (!sid) throw new Error("WhatsApp sender SID is missing");
  return await twilioJson(`https://messaging.twilio.com/v2/Channels/Senders/${encodeURIComponent(sid)}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        callback_url: webhookUrl,
        callback_method: "POST",
        status_callback_url: statusCallbackUrl,
        status_callback_method: "POST",
      },
    }),
  });
}

const sampleFor = (name: string) => {
  const key = String(name || "").toLowerCase();
  if (key.includes("name")) return "Ayanda";
  if (key.includes("status")) return "Under review";
  if (key.includes("date")) return "10 September 2026";
  if (key.includes("time")) return "14:00";
  if (key.includes("link") || key.includes("url")) return "https://reskonnect.org";
  if (key.includes("residence")) return "Example Student Residence";
  return "Example";
};

function toTwilioBody(preview: string, variables: string[]) {
  let body = String(preview || "");
  variables.forEach((name, index) => {
    const pattern = new RegExp(`\\{\\{${String(name).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\}\\}`, "g");
    body = body.replace(pattern, `{{${index + 1}}}`);
  });
  return body;
}

async function listContentTemplates() {
  const data = await twilioJson("https://content.twilio.com/v1/Content?PageSize=100");
  return Array.isArray(data?.contents) ? data.contents : Array.isArray(data?.content) ? data.content : [];
}

async function createContentTemplate(row: any) {
  const vars = Array.isArray(row.variables) ? row.variables : [];
  const samples: Record<string, string> = {};
  vars.forEach((name: string, index: number) => { samples[String(index + 1)] = sampleFor(name); });
  const body = toTwilioBody(row.preview_text, vars);
  return await twilioJson("https://content.twilio.com/v1/Content", {
    method: "POST",
    body: JSON.stringify({
      friendly_name: row.template_key,
      language: row.language || "en",
      variables: samples,
      types: { "twilio/text": { body } },
    }),
  });
}

async function submitApproval(contentSid: string, name: string, category = "UTILITY") {
  try {
    return await twilioJson(`https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}/ApprovalRequests/whatsapp`, {
      method: "POST",
      body: JSON.stringify({ name, category }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already|submitted|exists|duplicate/i.test(message)) return { status: "pending", duplicate_submission: true };
    throw error;
  }
}

async function approvalStatus(contentSid: string) {
  const data = await twilioJson(`https://content.twilio.com/v1/Content/${encodeURIComponent(contentSid)}/ApprovalRequests`);
  const wa = data?.whatsapp || {};
  return {
    status: String(wa.status || "unknown").toLowerCase(),
    rejection_reason: wa.rejection_reason || null,
    category: wa.category || null,
    name: wa.name || null,
  };
}

async function syncLocalTemplates(service: any) {
  const { data: rows, error } = await service.from("adminos_whatsapp_templates").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  const results: any[] = [];
  for (const row of rows || []) {
    if (!row.content_sid) continue;
    try {
      const approval = await approvalStatus(row.content_sid);
      const mapped = approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "pending_approval";
      await service.from("adminos_whatsapp_templates").update({
        status: mapped,
        metadata: { ...(row.metadata || {}), twilio_approval: approval, synced_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ template_key: row.template_key, content_sid: row.content_sid, status: mapped, rejection_reason: approval.rejection_reason });
    } catch (error) {
      results.push({ template_key: row.template_key, content_sid: row.content_sid, status: row.status, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

async function createAndSubmitTemplates(service: any) {
  const { data: rows, error } = await service.from("adminos_whatsapp_templates").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  const remote = await listContentTemplates();
  const byName = new Map(remote.map((item: any) => [String(item.friendly_name || item.friendlyName || ""), item]));
  const results: any[] = [];

  for (const row of rows || []) {
    let contentSid = row.content_sid as string | null;
    try {
      if (!contentSid) {
        const existing: any = byName.get(row.template_key);
        if (existing?.sid) {
          contentSid = existing.sid;
        } else {
          const created = await createContentTemplate(row);
          contentSid = created.sid;
        }
        if (!contentSid) throw new Error("Twilio did not return a Content SID");
        await service.from("adminos_whatsapp_templates").update({
          content_sid: contentSid,
          status: "created",
          metadata: { ...(row.metadata || {}), twilio_created_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
      }

      const category = row.message_kind === "marketing" ? "MARKETING" : "UTILITY";
      await submitApproval(contentSid, row.template_key, category);
      const approval = await approvalStatus(contentSid).catch(() => ({ status: "pending", rejection_reason: null, category, name: row.template_key }));
      const mapped = approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "pending_approval";
      await service.from("adminos_whatsapp_templates").update({
        content_sid: contentSid,
        status: mapped,
        metadata: { ...(row.metadata || {}), twilio_approval: approval, submitted_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ template_key: row.template_key, content_sid: contentSid, status: mapped, rejection_reason: approval.rejection_reason });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await service.from("adminos_whatsapp_templates").update({
        status: "provider_error",
        metadata: { ...(row.metadata || {}), provider_error: message, provider_error_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      results.push({ template_key: row.template_key, content_sid: contentSid, status: "provider_error", error: message });
    }
  }
  return results;
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
  const credentialsReady = Boolean(accountSid && authToken);

  if (action === "health") {
    return json({
      ok: true,
      credentials_ready: credentialsReady,
      account_sid_configured: Boolean(accountSid),
      auth_token_configured: Boolean(authToken),
      preferred_sender_configured: Boolean(preferredFrom),
      webhook_url: webhookUrl,
    });
  }

  if (!credentialsReady) return json({ error: "Twilio credentials are not yet in Supabase secrets", manual_required: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] }, 409);

  try {
    if (action === "bootstrap_whatsapp" || action === "finish_whatsapp") {
      const account = await twilioJson(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`);
      const senders = await listWhatsAppSenders();
      const sender = pickSender(senders);
      const updated = await configureSenderWebhook(sender);
      const senderId = String(updated.sender_id || updated.senderId || sender.sender_id || sender.senderId || "");
      const senderSid = String(updated.sid || sender.sid || "");
      const senderStatus = String(updated.status || sender.status || "").toUpperCase();
      const now = new Date().toISOString();
      const { data: integration } = await service.from("adminos_integration_connections").select("config").eq("provider", "twilio_whatsapp").maybeSingle();
      await service.from("adminos_integration_connections").update({
        status: senderStatus === "ONLINE" ? "connected" : "needs_action",
        enabled: senderStatus === "ONLINE",
        setup_step: senderStatus === "ONLINE" ? 3 : 2,
        external_account_label: `${account.friendly_name || "Twilio"} · ${senderId || senderSid}`,
        config: {
          ...(integration?.config || {}),
          sender_sid: senderSid,
          sender_id: senderId,
          sender_status: senderStatus,
          production_webhook_url: webhookUrl,
          status_callback_url: statusCallbackUrl,
          auto_configured: true,
          auto_configured_at: now,
        },
        last_tested_at: now,
        last_success_at: now,
        last_error: null,
      }).eq("provider", "twilio_whatsapp");

      let templates: any[] | null = null;
      if (action === "finish_whatsapp") templates = await createAndSubmitTemplates(service);
      return json({ ok: true, sender: { sid: senderSid, sender_id: senderId, status: senderStatus }, webhook_configured: true, templates });
    }

    if (action === "create_templates") return json({ ok: true, templates: await createAndSubmitTemplates(service) });
    if (action === "sync_templates") return json({ ok: true, templates: await syncLocalTemplates(service) });

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await service.from("adminos_integration_connections").update({
      last_tested_at: new Date().toISOString(),
      last_error_at: new Date().toISOString(),
      last_error: message,
    }).eq("provider", "twilio_whatsapp");
    return json({ error: message }, 400);
  }
});
