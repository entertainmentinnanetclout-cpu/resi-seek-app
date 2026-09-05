import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-adminos-cron-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const anonKey = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const whatsappFrom = env("TWILIO_WHATSAPP_FROM");
const gmailClientId = env("GMAIL_CLIENT_ID");
const gmailClientSecret = env("GMAIL_CLIENT_SECRET");
const gmailRefreshToken = env("GMAIL_REFRESH_TOKEN");
const gmailAccessToken = env("GMAIL_ACCESS_TOKEN");
const gmailSender = env("GMAIL_SENDER_EMAIL");

const digits = (value = "") => value.replace(/^whatsapp:/i, "").replace(/\D/g, "");
const e164 = (value = "") => { let d = digits(value); if (d.startsWith("0") && d.length === 10) d = `27${d.slice(1)}`; if (!d.startsWith("27") && d.length === 9) d = `27${d}`; return d ? `+${d}` : ""; };
const wa = (value = "") => { const n = e164(value); return n ? `whatsapp:${n}` : ""; };
const basicTwilio = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;
const firstName = (name = "") => String(name || "there").trim().split(/\s+/)[0] || "there";
const render = (template: string, data: Record<string,string>) => template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => data[key] ?? "");

async function gmailToken() {
  if (gmailAccessToken) return gmailAccessToken;
  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) throw new Error("gmail_not_configured");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: gmailClientId, client_secret: gmailClientSecret, refresh_token: gmailRefreshToken, grant_type: "refresh_token" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(d.error_description || d.error || "gmail_oauth_failed");
  return String(d.access_token);
}
const b64url = (value: string) => { const bytes = new TextEncoder().encode(value); let binary = ""; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); };
async function gmailSend(to: string, subject: string, body: string) {
  const token = await gmailToken();
  const raw = b64url(`To: ${to}\r\nFrom: ${gmailSender || "ResKonnect"}\r\nSubject: ${subject}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}`);
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `gmail_http_${r.status}`);
  return d;
}
async function twilioSend(to: string, body: string | null, templateSid?: string | null, templateVars?: any) {
  if (!accountSid || !authToken || !whatsappFrom) throw new Error("twilio_not_configured");
  const form = new URLSearchParams({ From: wa(whatsappFrom), To: wa(to) });
  if (templateSid) { form.set("ContentSid", templateSid); if (templateVars && Object.keys(templateVars).length) form.set("ContentVariables", JSON.stringify(templateVars)); }
  else form.set("Body", body || "");
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { Authorization: basicTwilio(), "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.message || `twilio_http_${r.status}`);
  return d;
}
function johannesburgHour() { const parts = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", hour12: false }).formatToParts(new Date()); return Number(parts.find((p) => p.type === "hour")?.value || 0); }
async function authorized(req: Request, service: any) {
  const cronToken = req.headers.get("x-adminos-cron-token") || "";
  if (cronToken) {
    const { data } = await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key", "followup_autopilot").maybeSingle();
    if (data?.secret_value && cronToken.length === data.secret_value.length) { let diff = 0; for (let i = 0; i < cronToken.length; i++) diff |= cronToken.charCodeAt(i) ^ data.secret_value.charCodeAt(i); if (diff === 0) return { ok: true, actor: "scheduler", userId: null }; }
  }
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader || !anonKey) return { ok: false, actor: null, userId: null };
  const auth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data } = await auth.auth.getUser();
  const user = data?.user;
  if (!user) return { ok: false, actor: null, userId: null };
  const role = await service.rpc("get_user_staff_role", { _user_id: user.id });
  return { ok: Boolean(role.data), actor: role.data ? "staff" : null, userId: role.data ? user.id : null };
}
async function communicationAllowed(service: any, contactId: string, channel: string, purpose: string) {
  const { data: prefs } = await service.from("adminos_communication_preferences").select("*").eq("contact_id", contactId).maybeSingle();
  if (prefs?.do_not_contact) return { allowed: false, reason: "do_not_contact" };
  if (channel === "email" && prefs?.email_allowed === false) return { allowed: false, reason: "email_disabled" };
  if (channel === "whatsapp" && prefs?.whatsapp_allowed === false) return { allowed: false, reason: "whatsapp_disabled" };
  if (purpose === "marketing") {
    if (!prefs?.marketing_allowed) return { allowed: false, reason: "marketing_disabled" };
    const consent = await service.from("adminos_consents").select("id").eq("contact_id", contactId).eq("status", "granted").eq("channel", channel).in("purpose", ["marketing", "direct_marketing"]).limit(1).maybeSingle();
    if (!consent.data) return { allowed: false, reason: "marketing_consent_missing" };
  }
  const hour = johannesburgHour();
  if (hour >= 20 || hour < 8) return { allowed: false, reason: "quiet_hours" };
  return { allowed: true, reason: "allowed" };
}
async function recentInbound(service: any, contactId: string, since: string) {
  const [waIn, mailIn, enquiryIn] = await Promise.all([
    service.from("adminos_whatsapp_messages").select("id").eq("contact_id", contactId).eq("direction", "inbound").gt("created_at", since).limit(1),
    service.from("adminos_email_messages").select("id").eq("contact_id", contactId).eq("direction", "inbound").gt("created_at", since).limit(1),
    service.from("adminos_enquiry_threads").select("id").eq("contact_id", contactId).gt("last_message_at", since).limit(1),
  ]);
  return Boolean(waIn.data?.length || mailIn.data?.length || enquiryIn.data?.length);
}
async function executeStep(service: any, enrollment: any, step: any, contact: any, sequence: any) {
  const idem = `followup:${enrollment.id}:step:${step.step_order}`;
  const prior = await service.from("adminos_followup_attempts").select("id,status").eq("idempotency_key", idem).maybeSingle();
  if (prior.data) return { status: prior.data.status, duplicate: true };
  const attemptBase: any = { enrollment_id: enrollment.id, step_id: step.id, contact_id: contact.id, channel: step.channel, action_type: step.action_type, scheduled_for: enrollment.next_run_at, idempotency_key: idem };
  if (sequence.config?.stop_on_reply !== false && await recentInbound(service, contact.id, enrollment.enrolled_at)) {
    await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "skipped", executed_at: new Date().toISOString(), output: { reason: "contact_replied" } });
    await service.from("adminos_followup_enrollments").update({ status: "completed", completed_at: new Date().toISOString(), next_run_at: null, metadata: { ...(enrollment.metadata || {}), stopped_reason: "contact_replied" } }).eq("id", enrollment.id);
    return { status: "skipped", reason: "contact_replied", terminal: true };
  }
  if (step.action_type === "create_task") {
    const task = await service.from("conversion_automation_tasks").insert({ task_type: step.config?.task_type || "followup", source_type: "adminos_followup_enrollment", source_id: enrollment.id, user_id: contact.profile_user_id || null, owner_scope: "admin", status: "pending", priority: step.config?.priority || "normal", due_at: new Date().toISOString(), summary: step.config?.summary || `Follow up with ${contact.full_name || "contact"}`, payload: { release: 3, phase: 7, sequence_key: sequence.sequence_key, enrollment_id: enrollment.id, contact_id: contact.id } }).select("id").single();
    if (task.error) throw task.error;
    await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "completed", executed_at: new Date().toISOString(), output: { task_id: task.data.id } });
    return { status: "completed", task_id: task.data.id };
  }
  const channel = String(step.channel || "");
  const templateKey = String(step.config?.template_key || "");
  const tmpl = await service.from("adminos_followup_message_templates").select("*").eq("template_key", templateKey).eq("channel", channel).eq("active", true).maybeSingle();
  if (!tmpl.data) { await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "failed", executed_at: new Date().toISOString(), error_message: "message_template_missing" }); return { status: "failed", reason: "message_template_missing" }; }
  const permission = await communicationAllowed(service, contact.id, channel, tmpl.data.purpose);
  if (!permission.allowed) { const retryLater = permission.reason === "quiet_hours"; await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: retryLater ? "planned" : "blocked", executed_at: retryLater ? null : new Date().toISOString(), output: { reason: permission.reason } }); return { status: retryLater ? "planned" : "blocked", reason: permission.reason, retryLater }; }
  const data = { first_name: firstName(contact.full_name), full_name: contact.full_name || "", email: contact.email || "", phone: contact.phone || "" };
  const body = render(tmpl.data.body_template, data);
  const subject = tmpl.data.subject_template ? render(tmpl.data.subject_template, data) : "";
  if (channel === "email") {
    if (!contact.email) { await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "blocked", executed_at: new Date().toISOString(), output: { reason: "email_missing" } }); return { status: "blocked", reason: "email_missing" }; }
    const outbox = await service.from("adminos_email_outbox").insert({ contact_id: contact.id, source_type: "followup_enrollment", source_id: enrollment.id, to_email: contact.email, subject: subject || "ResKonnect follow-up", body_text: body, risk_level: tmpl.data.risk_level || "green", status: "queued", idempotency_key: idem, metadata: { release: 3, phase: 7, sequence_key: sequence.sequence_key, template_key: templateKey } }).select("id").single();
    if (outbox.error) throw outbox.error;
    try {
      const sent = await gmailSend(contact.email, subject || "ResKonnect follow-up", body); const now = new Date().toISOString();
      await service.from("adminos_email_outbox").update({ status: "sent", gmail_message_id: sent.id, sent_at: now, attempts: 1 }).eq("id", outbox.data.id);
      await service.from("adminos_email_messages").upsert({ contact_id: contact.id, gmail_message_id: sent.id, direction: "outbound", from_email: gmailSender || null, to_emails: [contact.email], subject: subject || "ResKonnect follow-up", body_text: body, sent_at: now, metadata: { source: "followup_autopilot", enrollment_id: enrollment.id } }, { onConflict: "gmail_message_id" });
      await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "sent", executed_at: now, output: { outbox_id: outbox.data.id, gmail_message_id: sent.id } });
      return { status: "sent", outbox_id: outbox.data.id };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e); const status = error === "gmail_not_configured" ? "queued" : "failed";
      await service.from("adminos_email_outbox").update({ status, last_error: error }).eq("id", outbox.data.id);
      await service.from("adminos_followup_attempts").insert({ ...attemptBase, status, executed_at: new Date().toISOString(), output: { outbox_id: outbox.data.id }, error_message: error });
      return { status, reason: error };
    }
  }
  if (channel === "whatsapp") {
    if (!contact.phone) { await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "blocked", executed_at: new Date().toISOString(), output: { reason: "phone_missing" } }); return { status: "blocked", reason: "phone_missing" }; }
    const thread = await service.from("adminos_whatsapp_threads").select("id,customer_window_expires_at").eq("contact_id", contact.id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
    const windowOpen = !!thread.data?.customer_window_expires_at && new Date(thread.data.customer_window_expires_at).getTime() > Date.now();
    if (!windowOpen && !tmpl.data.provider_template_sid) { await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "blocked", executed_at: new Date().toISOString(), output: { reason: "approved_whatsapp_template_required" } }); return { status: "blocked", reason: "approved_whatsapp_template_required" }; }
    const outbox = await service.from("adminos_whatsapp_outbox").insert({ contact_id: contact.id, thread_id: thread.data?.id || null, source_type: "followup_enrollment", source_id: enrollment.id, to_address: e164(contact.phone), body_text: windowOpen ? body : null, message_kind: tmpl.data.purpose, template_sid: !windowOpen ? tmpl.data.provider_template_sid : null, template_vars: !windowOpen ? { "1": firstName(contact.full_name) } : {}, risk_level: tmpl.data.risk_level || "green", status: "queued", idempotency_key: idem, metadata: { release: 3, phase: 7, sequence_key: sequence.sequence_key, template_key: templateKey } }).select("id").single();
    if (outbox.error) throw outbox.error;
    try {
      const sent = await twilioSend(contact.phone, windowOpen ? body : null, !windowOpen ? tmpl.data.provider_template_sid : null, !windowOpen ? { "1": firstName(contact.full_name) } : {}); const now = new Date().toISOString();
      await service.from("adminos_whatsapp_outbox").update({ status: "sent", twilio_message_sid: sent.sid, sent_at: now, attempts: 1 }).eq("id", outbox.data.id);
      await service.from("adminos_whatsapp_messages").upsert({ thread_id: thread.data?.id, contact_id: contact.id, twilio_message_sid: sent.sid, direction: "outbound", from_address: wa(whatsappFrom), to_address: wa(contact.phone), body_text: windowOpen ? body : null, message_kind: tmpl.data.purpose, status: sent.status === "queued" ? "queued" : "sent", risk_level: tmpl.data.risk_level || "green", sent_at: now, metadata: { source: "followup_autopilot", enrollment_id: enrollment.id, template_sid: !windowOpen ? tmpl.data.provider_template_sid : null } }, { onConflict: "twilio_message_sid" });
      await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "sent", executed_at: now, output: { outbox_id: outbox.data.id, twilio_message_sid: sent.sid } }); return { status: "sent", outbox_id: outbox.data.id };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e); const status = error === "twilio_not_configured" ? "queued" : "failed";
      await service.from("adminos_whatsapp_outbox").update({ status, last_error: error }).eq("id", outbox.data.id);
      await service.from("adminos_followup_attempts").insert({ ...attemptBase, status, executed_at: new Date().toISOString(), output: { outbox_id: outbox.data.id }, error_message: error }); return { status, reason: error };
    }
  }
  await service.from("adminos_followup_attempts").insert({ ...attemptBase, status: "failed", executed_at: new Date().toISOString(), error_message: "unsupported_channel" }); return { status: "failed", reason: "unsupported_channel" };
}
async function advance(service: any, enrollment: any, result: any) {
  if (result.terminal) return;
  if (result.retryLater) { await service.from("adminos_followup_enrollments").update({ next_run_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() }).eq("id", enrollment.id); return; }
  const nextOrder = Number(enrollment.current_step || 0) + 2;
  const next = await service.from("adminos_followup_steps").select("*").eq("sequence_id", enrollment.sequence_id).eq("step_order", nextOrder).eq("enabled", true).maybeSingle();
  if (!next.data) { await service.from("adminos_followup_enrollments").update({ status: "completed", current_step: Number(enrollment.current_step || 0) + 1, next_run_at: null, completed_at: new Date().toISOString() }).eq("id", enrollment.id); return; }
  await service.from("adminos_followup_enrollments").update({ current_step: Number(enrollment.current_step || 0) + 1, next_run_at: new Date(Date.now() + Number(next.data.delay_minutes || 0) * 60 * 1000).toISOString() }).eq("id", enrollment.id);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase runtime is not configured" }, 500);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const authz = await authorized(req, service);
  if (!authz.ok) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "health");
  if (action === "health") { const cron = await service.from("adminos_scheduler_secrets").select("secret_key").eq("secret_key", "followup_autopilot").maybeSingle(); return json({ ok: true, scheduler_secret: Boolean(cron.data), cron_actor: authz.actor === "scheduler", release: 3, phase: 7 }); }
  if (action === "enroll") {
    if (!authz.userId) return json({ error: "Staff authentication required for manual enrollment" }, 403);
    const sequenceKey = String(body.sequence_key || ""), contactId = String(body.contact_id || "");
    if (!sequenceKey || !contactId) return json({ error: "sequence_key and contact_id are required" }, 400);
    const sequence = await service.from("adminos_followup_sequences").select("*").eq("sequence_key", sequenceKey).eq("enabled", true).maybeSingle();
    if (!sequence.data) return json({ error: "Sequence not found or disabled" }, 404);
    const contact = await service.from("adminos_contacts").select("id").eq("id", contactId).maybeSingle();
    if (!contact.data) return json({ error: "Contact not found" }, 404);
    const first = await service.from("adminos_followup_steps").select("*").eq("sequence_id", sequence.data.id).eq("step_order", 1).eq("enabled", true).maybeSingle();
    if (!first.data) return json({ error: "Sequence has no enabled first step" }, 409);
    const insert = await service.from("adminos_followup_enrollments").insert({ sequence_id: sequence.data.id, contact_id: contactId, prospect_id: body.prospect_id || null, status: "active", current_step: 0, next_run_at: new Date(Date.now() + Number(first.data.delay_minutes || 0) * 60 * 1000).toISOString(), metadata: { source: "manual", enrolled_by: authz.userId, release: 3 } }).select("*").single();
    if (insert.error) return json({ error: insert.error.message }, 409);
    return json({ ok: true, enrollment: insert.data });
  }
  if (["pause", "resume", "cancel"].includes(action)) {
    if (!authz.userId) return json({ error: "Staff authentication required" }, 403);
    const id = String(body.enrollment_id || ""); if (!id) return json({ error: "enrollment_id is required" }, 400);
    if (action === "pause") await service.from("adminos_followup_enrollments").update({ status: "paused" }).eq("id", id);
    if (action === "cancel") await service.from("adminos_followup_enrollments").update({ status: "cancelled", next_run_at: null, completed_at: new Date().toISOString() }).eq("id", id);
    if (action === "resume") await service.from("adminos_followup_enrollments").update({ status: "active", next_run_at: new Date().toISOString() }).eq("id", id);
    return json({ ok: true, enrollment_id: id, action });
  }
  if (action !== "tick") return json({ error: "Unsupported action" }, 400);
  const max = Math.max(1, Math.min(100, Number(body.max || 25)));
  const due = await service.from("adminos_followup_enrollments").select("*").eq("status", "active").lte("next_run_at", new Date().toISOString()).order("next_run_at", { ascending: true }).limit(max);
  const results: any[] = [];
  for (const enrollment of due.data || []) {
    try {
      const [sequenceRes, contactRes, stepRes] = await Promise.all([
        service.from("adminos_followup_sequences").select("*").eq("id", enrollment.sequence_id).maybeSingle(),
        service.from("adminos_contacts").select("*").eq("id", enrollment.contact_id).maybeSingle(),
        service.from("adminos_followup_steps").select("*").eq("sequence_id", enrollment.sequence_id).eq("step_order", Number(enrollment.current_step || 0) + 1).eq("enabled", true).maybeSingle(),
      ]);
      const sequence = sequenceRes.data, contact = contactRes.data, step = stepRes.data;
      if (!sequence?.enabled || !contact || !step) { await service.from("adminos_followup_enrollments").update({ status: "completed", next_run_at: null, completed_at: new Date().toISOString(), metadata: { ...(enrollment.metadata || {}), stopped_reason: "missing_sequence_contact_or_step" } }).eq("id", enrollment.id); results.push({ enrollment_id: enrollment.id, status: "completed", reason: "missing_sequence_contact_or_step" }); continue; }
      if (enrollment.prospect_id && Array.isArray(sequence.config?.stop_stages) && sequence.config.stop_stages.length) {
        const prospect = await service.from("adminos_prospects").select("stage").eq("id", enrollment.prospect_id).maybeSingle();
        if (prospect.data && sequence.config.stop_stages.includes(prospect.data.stage)) { await service.from("adminos_followup_enrollments").update({ status: "completed", next_run_at: null, completed_at: new Date().toISOString(), metadata: { ...(enrollment.metadata || {}), stopped_reason: `prospect_stage:${prospect.data.stage}` } }).eq("id", enrollment.id); results.push({ enrollment_id: enrollment.id, status: "completed", reason: `prospect_stage:${prospect.data.stage}` }); continue; }
      }
      const result = await executeStep(service, enrollment, step, contact, sequence); await advance(service, enrollment, result); results.push({ enrollment_id: enrollment.id, step: step.step_order, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e); results.push({ enrollment_id: enrollment.id, status: "failed", error: message });
      await service.from("adminos_agent_errors").insert({ agent_key: "followup_autopilot", error_code: "followup_tick_failed", error_message: message, context: { enrollment_id: enrollment.id }, retryable: true });
    }
  }
  await service.from("adminos_audit_events").insert({ actor_type: authz.actor || "system", actor_id: authz.userId, action: "followup.tick", entity_type: "adminos_release", after_state: { processed: results.length }, metadata: { release: 3, phase: 7, source: body.source || "manual" } });
  return json({ ok: true, processed: results.length, results, release: 3, phase: 7 });
});
