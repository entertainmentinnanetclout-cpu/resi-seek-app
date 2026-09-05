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
const clientId = env("GMAIL_CLIENT_ID");
const clientSecret = env("GMAIL_CLIENT_SECRET");
const refreshToken = env("GMAIL_REFRESH_TOKEN");
const configuredSender = env("GMAIL_SENDER_EMAIL").toLowerCase();

const b64urlDecode = (value = "") => {
  if (!value) return "";
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ""; }
};
const b64urlEncode = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const getHeader = (payload: any, name: string) => (payload?.headers || []).find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value || "";
const emailOnly = (value = "") => {
  const bracket = value.match(/<([^>]+)>/);
  const raw = bracket?.[1] || value;
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (match?.[0] || "").toLowerCase();
};
const nameOnly = (value = "") => value.replace(/<[^>]+>/g, "").replace(/[\"]/g, "").trim();
const extractBody = (payload: any): string => {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return b64urlDecode(payload.body.data);
  for (const part of payload.parts || []) {
    const text = extractBody(part);
    if (text) return text;
  }
  if (payload.body?.data) {
    const raw = b64urlDecode(payload.body.data);
    if (payload.mimeType === "text/html") return raw.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return raw;
  }
  return "";
};

async function accessToken() {
  const direct = env("GMAIL_ACCESS_TOKEN");
  if (direct) return direct;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail OAuth secrets are not configured");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(data.error_description || data.error || `OAuth HTTP ${r.status}`);
  return String(data.access_token);
}

async function gmailGet(token: string, path: string) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Gmail HTTP ${r.status}`);
  return data;
}

async function sendRaw(token: string, to: string, subject: string, body: string, cc: string[] = [], threadId?: string | null, inReplyTo?: string | null) {
  const headers = [
    `To: ${to}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`, `References: ${inReplyTo}`] : []),
  ];
  const raw = b64urlEncode(`${headers.join("\r\n")}\r\n\r\n${body}`);
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Gmail send HTTP ${r.status}`);
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: "Supabase runtime is not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "health");
  const hasOAuth = Boolean((env("GMAIL_ACCESS_TOKEN") || (clientId && clientSecret && refreshToken)));
  if (action === "health") return json({ ok: hasOAuth, configured: { oauth: hasOAuth, sender: Boolean(configuredSender) }, release: 2, phase: 5 });

  const authHeader = req.headers.get("Authorization") || "";
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: userData } = await authClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Authentication required" }, 401);
  const { data: staffRole } = await service.rpc("get_user_staff_role", { _user_id: user.id });
  if (!staffRole) return json({ error: "Staff access required" }, 403);

  let token: string;
  try { token = await accessToken(); }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await service.from("adminos_integration_connections").update({ status: "needs_action", enabled: false, last_error: message, last_error_at: new Date().toISOString(), setup_step: 2 }).eq("provider", "gmail");
    return json({ error: message, setup_required: true }, 503);
  }

  let profile: any;
  try { profile = await gmailGet(token, "profile"); }
  catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await service.from("adminos_integration_connections").update({ status: "error", enabled: false, last_error: message, last_error_at: new Date().toISOString() }).eq("provider", "gmail");
    return json({ error: message }, 502);
  }
  const accountEmail = String(profile.emailAddress || configuredSender || "").toLowerCase();
  await service.from("adminos_integration_connections").update({
    status: "connected", enabled: true, setup_step: 3, external_account_label: accountEmail,
    last_tested_at: new Date().toISOString(), last_success_at: new Date().toISOString(), last_error: null,
  }).eq("provider", "gmail");

  if (action === "test") return json({ ok: true, email: accountEmail, messages_total: profile.messagesTotal, threads_total: profile.threadsTotal, release: 2, phase: 5 });

  if (action === "send_outbox") {
    const outboxId = String(body.outbox_id || "");
    if (!outboxId) return json({ error: "outbox_id is required" }, 400);
    const { data: item } = await service.from("adminos_email_outbox").select("*, adminos_email_threads(gmail_thread_id)").eq("id", outboxId).maybeSingle();
    if (!item) return json({ error: "Outbox item not found" }, 404);
    if (["sent", "cancelled", "blocked"].includes(item.status)) return json({ error: `Outbox item is ${item.status}` }, 409);
    if (item.risk_level !== "green") {
      if (!item.approval_id) return json({ error: "Human approval required" }, 409);
      const { data: approval } = await service.from("adminos_approval_requests").select("status").eq("id", item.approval_id).maybeSingle();
      if (approval?.status !== "approved") return json({ error: "Approval has not been granted" }, 409);
    }
    try {
      await service.from("adminos_email_outbox").update({ status: "sending", attempts: Number(item.attempts || 0) + 1 }).eq("id", item.id);
      const sent = await sendRaw(token, item.to_email, item.subject, item.body_text, item.cc_emails || [], item.adminos_email_threads?.gmail_thread_id || null, item.metadata?.in_reply_to || null);
      await service.from("adminos_email_outbox").update({ status: "sent", gmail_message_id: sent.id, sent_at: new Date().toISOString(), last_error: null }).eq("id", item.id);
      await service.from("adminos_email_messages").upsert({
        thread_id: item.thread_id, gmail_message_id: sent.id, contact_id: item.contact_id, direction: "outbound",
        from_email: accountEmail, to_emails: [item.to_email], cc_emails: item.cc_emails || [], subject: item.subject,
        body_text: item.body_text, sent_at: new Date().toISOString(), metadata: { source: "adminos_outbox", outbox_id: item.id },
      }, { onConflict: "gmail_message_id" });
      return json({ ok: true, sent_id: sent.id, thread_id: sent.threadId, outbox_id: item.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await service.from("adminos_email_outbox").update({ status: "failed", last_error: message }).eq("id", item.id);
      return json({ error: message }, 502);
    }
  }

  if (action !== "sync") return json({ error: "Unsupported action" }, 400);

  const maxResults = Math.max(1, Math.min(30, Number(body.max_results || 15)));
  const query = String(body.query || "newer_than:7d");
  const list = await gmailGet(token, `messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`);
  let imported = 0, inboundNew = 0, drafted = 0, autoSent = 0, escalated = 0;
  const { data: emailCfg } = await service.from("adminos_agent_config").select("config,confidence_threshold,enabled").eq("agent_key", "email_agent").maybeSingle();
  const autoDraft = emailCfg?.enabled !== false && emailCfg?.config?.auto_draft !== false;
  const autoSendGreen = emailCfg?.enabled !== false && emailCfg?.config?.auto_send_green === true;

  for (const ref of list.messages || []) {
    const gm = await gmailGet(token, `messages/${ref.id}?format=full`);
    const fromRaw = getHeader(gm.payload, "From");
    const toRaw = getHeader(gm.payload, "To");
    const ccRaw = getHeader(gm.payload, "Cc");
    const subject = getHeader(gm.payload, "Subject") || "(no subject)";
    const messageIdHeader = getHeader(gm.payload, "Message-ID");
    const fromEmail = emailOnly(fromRaw);
    const toEmails = toRaw.split(",").map(emailOnly).filter(Boolean);
    const ccEmails = ccRaw.split(",").map(emailOnly).filter(Boolean);
    const direction = fromEmail && fromEmail === accountEmail ? "outbound" : "inbound";
    const counterpart = direction === "inbound" ? fromEmail : (toEmails.find((e: string) => e !== accountEmail) || toEmails[0] || "");
    const internalDate = gm.internalDate ? new Date(Number(gm.internalDate)).toISOString() : new Date().toISOString();
    const text = extractBody(gm.payload).slice(0, 30000);

    const { data: existing } = await service.from("adminos_email_messages").select("id").eq("gmail_message_id", gm.id).maybeSingle();
    let contactId: string | null = null;
    if (counterpart) {
      const { data: found } = await service.from("adminos_contacts").select("id").ilike("email", counterpart).limit(1).maybeSingle();
      contactId = found?.id || null;
      if (!contactId) {
        const resolved = await service.rpc("adminos_resolve_contact", {
          p_full_name: nameOnly(direction === "inbound" ? fromRaw : counterpart) || counterpart.split("@")[0],
          p_email: counterpart, p_phone: null, p_profile_user_id: null, p_source_type: "gmail", p_source_id: null,
          p_metadata: { source: "gmail_sync" },
        });
        contactId = resolved.data || null;
      }
    }

    let { data: thread } = await service.from("adminos_email_threads").select("id,gmail_thread_id").eq("gmail_thread_id", gm.threadId).maybeSingle();
    if (!thread) {
      const created = await service.from("adminos_email_threads").insert({
        gmail_thread_id: gm.threadId, contact_id: contactId, subject,
        participants: Array.from(new Set([fromEmail, ...toEmails, ...ccEmails].filter(Boolean))),
        last_message_at: internalDate, metadata: { source: "gmail" },
      }).select("id,gmail_thread_id").single();
      thread = created.data;
    } else {
      await service.from("adminos_email_threads").update({ contact_id: contactId || undefined, subject, last_message_at: internalDate }).eq("id", thread.id);
    }
    if (!thread) continue;

    await service.from("adminos_email_messages").upsert({
      thread_id: thread.id, gmail_message_id: gm.id, contact_id: contactId, direction,
      from_email: fromEmail || null, to_emails: toEmails, cc_emails: ccEmails, subject,
      body_text: text, snippet: gm.snippet || null,
      received_at: direction === "inbound" ? internalDate : null,
      sent_at: direction === "outbound" ? internalDate : null,
      metadata: { label_ids: gm.labelIds || [], message_id_header: messageIdHeader || null },
    }, { onConflict: "gmail_message_id" });
    if (!existing) imported++;

    if (existing || direction !== "inbound" || !fromEmail) continue;
    inboundNew++;
    await service.from("adminos_automation_events").insert({
      event_type: "email.received", entity_type: "email_thread", entity_id: thread.id, contact_id: contactId,
      payload: { gmail_message_id: gm.id, from_email: fromEmail, subject }, correlation_id: `gmail:${gm.id}`,
    });

    if (!autoDraft || /(?:no-?reply|mailer-daemon|postmaster)@/i.test(fromEmail)) continue;
    const idempotencyKey = `gmail-reply:${gm.id}`;
    const { data: priorOutbox } = await service.from("adminos_email_outbox").select("id").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (priorOutbox) continue;

    const agentResponse = await fetch(`${supabaseUrl}/functions/v1/adminos-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
      body: JSON.stringify({
        action: "email_draft", contact_id: contactId, entity_type: "email_thread", entity_id: thread.id,
        message: `Inbound email from ${fromEmail}\nSubject: ${subject}\n\n${text}`,
        context: { channel: "email", gmail_message_id: gm.id, gmail_thread_id: gm.threadId },
      }),
    });
    const agent = await agentResponse.json().catch(() => ({}));
    if (!agentResponse.ok || !agent.answer) {
      await service.from("adminos_automation_events").insert({
        event_type: "email.escalated", entity_type: "email_thread", entity_id: thread.id, contact_id: contactId,
        payload: { reason: agent.error || "agent_unavailable", gmail_message_id: gm.id }, correlation_id: `gmail:${gm.id}:agent_error`,
      });
      escalated++;
      continue;
    }

    const risk = ["green", "amber", "red"].includes(agent.risk) ? agent.risk : "amber";
    const needsApproval = risk !== "green" || Boolean(agent.escalate);
    let approvalId: string | null = null;
    if (needsApproval) {
      const approval = await service.from("adminos_approval_requests").insert({
        request_type: "email_reply", title: `Review email reply: ${subject}`, summary: agent.reason || "Email Agent requested human review",
        entity_type: "email_thread", entity_id: thread.id,
        requested_action: { to_email: fromEmail, subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`, body_text: agent.answer, gmail_message_id: gm.id },
        risk_level: risk === "red" ? "red" : "amber", requested_by_type: "agent", requested_by_id: agent.run_id || null,
      }).select("id").single();
      approvalId = approval.data?.id || null;
    }

    const outbox = await service.from("adminos_email_outbox").insert({
      contact_id: contactId, thread_id: thread.id, source_type: "gmail_message", source_id: null,
      to_email: fromEmail, subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
      body_text: String(agent.answer), risk_level: risk, confidence: Number(agent.confidence || 0),
      status: needsApproval ? "awaiting_approval" : "draft", approval_id: approvalId, agent_run_id: agent.run_id || null,
      idempotency_key: idempotencyKey,
      metadata: { gmail_source_message_id: gm.id, in_reply_to: messageIdHeader || null, provider: agent.provider, model: agent.model },
    }).select("id,status").single();
    if (!outbox.data) continue;
    drafted++;

    if (needsApproval) {
      await service.from("adminos_automation_events").insert({
        event_type: "email.escalated", entity_type: "email_thread", entity_id: thread.id, contact_id: contactId,
        payload: { reason: agent.reason, risk, confidence: agent.confidence, outbox_id: outbox.data.id }, correlation_id: `gmail:${gm.id}:escalated`,
      });
      escalated++;
    } else if (autoSendGreen) {
      try {
        const sent = await sendRaw(token, fromEmail, subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`, String(agent.answer), [], gm.threadId, messageIdHeader || null);
        await service.from("adminos_email_outbox").update({ status: "sent", gmail_message_id: sent.id, sent_at: new Date().toISOString(), attempts: 1 }).eq("id", outbox.data.id);
        await service.from("adminos_email_messages").upsert({
          thread_id: thread.id, gmail_message_id: sent.id, contact_id: contactId, direction: "outbound",
          from_email: accountEmail, to_emails: [fromEmail], subject: subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`,
          body_text: String(agent.answer), sent_at: new Date().toISOString(), metadata: { source: "email_agent", outbox_id: outbox.data.id },
        }, { onConflict: "gmail_message_id" });
        autoSent++;
      } catch (e) {
        await service.from("adminos_email_outbox").update({ status: "failed", attempts: 1, last_error: e instanceof Error ? e.message : String(e) }).eq("id", outbox.data.id);
      }
    }
  }

  await service.from("adminos_integration_connections").update({ last_success_at: new Date().toISOString(), last_tested_at: new Date().toISOString(), last_error: null }).eq("provider", "gmail");
  return json({ ok: true, account: accountEmail, scanned: (list.messages || []).length, imported, inbound_new: inboundNew, drafted, auto_sent: autoSent, escalated, release: 2, phase: 5 });
});
