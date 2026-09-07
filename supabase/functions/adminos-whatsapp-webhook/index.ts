import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const fromNumber = env("TWILIO_WHATSAPP_FROM");
const canonicalWebhookUrl = env("TWILIO_WHATSAPP_WEBHOOK_URL");
const statusCallback = env("TWILIO_WHATSAPP_STATUS_CALLBACK_URL");
const PUBLIC_BASE = "https://www.reskonnect.org";

const text = (v: unknown) => String(v ?? "").trim();
const link = (path: string) => `${PUBLIC_BASE}${path.startsWith("/") ? path : `/${path}`}`;
const digits = (v = "") => String(v).replace(/^whatsapp:/i, "").replace(/\D/g, "");
const e164 = (v = "") => {
  let d = digits(v);
  if (d.startsWith("0") && d.length === 10) d = `27${d.slice(1)}`;
  if (!d.startsWith("27") && d.length === 9) d = `27${d}`;
  return d ? `+${d}` : "";
};
const wa = (v = "") => {
  const n = e164(v);
  return n ? `whatsapp:${n}` : "";
};
const norm = (v = "") => digits(e164(v));
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;
const xml = (status = 200) => new Response("<Response></Response>", { status, headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" } });
const first = (v = "") => String(v || "there").trim().split(/\s+/)[0] || "there";
const clean = (v = "") => String(v || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const LANGS = new Set(["en", "zu", "nso", "tn", "st", "xh", "af"]);
const menuForLanguage = (code: string) => code === "en" ? "rk_main_menu_v2" : `rk_main_menu_${code}`;

async function hmacSha1Base64(keyText: string, value: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(keyText), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  let bytes = "";
  for (const n of new Uint8Array(sig)) bytes += String.fromCharCode(n);
  return btoa(bytes);
}
async function verifySignature(req: Request, params: URLSearchParams) {
  if (!authToken) return false;
  const got = req.headers.get("X-Twilio-Signature") || "";
  if (!got) return false;
  const keys = Array.from(new Set(Array.from(params.keys()))).sort();
  let payload = canonicalWebhookUrl || req.url;
  for (const k of keys) for (const v of params.getAll(k)) payload += `${k}${v}`;
  const expected = await hmacSha1Base64(authToken, payload);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
async function verifyRest(params: URLSearchParams) {
  try {
    const sid = params.get("MessageSid") || params.get("SmsSid") || "";
    if (!sid || params.get("AccountSid") !== accountSid) return false;
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${encodeURIComponent(sid)}.json`, { headers: { Authorization: basic() } });
    const data = await response.json();
    if (!response.ok || data.sid !== sid || data.account_sid !== accountSid) return false;
    if (params.get("From") && data.from !== params.get("From")) return false;
    if (params.get("To") && data.to !== params.get("To")) return false;
    if (params.get("Body") !== null && String(data.body || "") !== String(params.get("Body") || "")) return false;
    return true;
  } catch { return false; }
}
async function twilioSend(form: URLSearchParams) {
  if (!accountSid || !authToken || !fromNumber) throw new Error("Twilio WhatsApp is not configured");
  if (statusCallback) form.set("StatusCallback", statusCallback);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Twilio HTTP ${response.status}`);
  return data;
}
async function activity(s: any, threadId: string, type: string, metadata: any = {}) { await s.from("adminos_whatsapp_activity").insert({ thread_id: threadId, actor_id: null, event_type: type, metadata }); }
async function persistSent(s: any, thread: any, contactId: string | null, to: string, sent: any, body: string | null, metadata: any = {}, touchThread = true) {
  const now = new Date().toISOString();
  const row = await s.from("adminos_whatsapp_messages").upsert({ thread_id: thread.id, contact_id: contactId, twilio_message_sid: sent.sid, direction: "outbound", from_address: wa(fromNumber), to_address: wa(to), body_text: body, message_kind: "service", status: sent.status === "queued" ? "queued" : "sent", risk_level: "green", sent_at: now, metadata: { source: "dimpho_whatsapp", author_type: "ai", persona: "Dimpho", ...metadata } }, { onConflict: "twilio_message_sid" }).select("id").maybeSingle();
  const patch = touchThread ? { last_message_at: now, last_outbound_at: now, status: "waiting", updated_at: now } : { last_message_at: now, last_outbound_at: now, updated_at: now };
  await s.from("adminos_whatsapp_threads").update(patch).eq("id", thread.id);
  await activity(s, thread.id, "dimpho.sent", { message_id: row.data?.id || null, twilio_message_sid: sent.sid, ...metadata });
  return row.data;
}
async function sendText(s: any, thread: any, contactId: string | null, to: string, body: string, metadata: any = {}, touchThread = true) {
  const clipped = body.trim().slice(0, 3500);
  const sent = await twilioSend(new URLSearchParams({ From: wa(fromNumber), To: wa(to), Body: clipped }));
  await persistSent(s, thread, contactId, to, sent, clipped, metadata, touchThread);
  return sent;
}
async function sendMedia(s: any, thread: any, contactId: string | null, to: string, body: string, url: string, metadata: any = {}) {
  const sent = await twilioSend(new URLSearchParams({ From: wa(fromNumber), To: wa(to), Body: body.slice(0, 3000), MediaUrl: url }));
  await persistSent(s, thread, contactId, to, sent, body, { ...metadata, rich_media: true });
  return sent;
}
async function sendRich(s: any, thread: any, contactId: string | null, to: string, key: string, vars: Record<string, string> = {}) {
  const row = (await s.from("adminos_whatsapp_rich_content").select("*").eq("content_key", key).maybeSingle()).data;
  if (!row?.content_sid) throw new Error(`Rich WhatsApp content ${key} is not ready`);
  const form = new URLSearchParams({ From: wa(fromNumber), To: wa(to), ContentSid: row.content_sid });
  if (Object.keys(vars).length) form.set("ContentVariables", JSON.stringify(vars));
  const sent = await twilioSend(form);
  await persistSent(s, thread, contactId, to, sent, String(row.config?.body || row.display_name), { content_key: key, content_sid: row.content_sid });
  const now = new Date().toISOString();
  await s.from("adminos_whatsapp_threads").update({ last_menu_key: key, last_menu_at: now }).eq("id", thread.id);
  thread.last_menu_key = key; thread.last_menu_at = now;
  return sent;
}
async function sendMenuIfUseful(s: any, thread: any, contactId: string | null, to: string, key: string, vars: Record<string, string> = {}, force = false) {
  const lastAt = thread.last_menu_at ? new Date(thread.last_menu_at).getTime() : 0;
  if (!force && thread.last_menu_key === key && Date.now() - lastAt < 30 * 60 * 1000) return false;
  await sendRich(s, thread, contactId, to, key, vars); return true;
}
async function identity(s: any, contactId: string | null, from: string) {
  let contact: any = contactId ? (await s.from("adminos_contacts").select("*").eq("id", contactId).maybeSingle()).data : null;
  let profile: any = null;
  if (contact?.profile_user_id) profile = (await s.from("profiles").select("id,full_name,email,phone,phone_number,student_number,campus,course,profile_picture_url").eq("id", contact.profile_user_id).maybeSingle()).data || null;
  if (!profile) {
    const intl = e164(from), local = intl.startsWith("+27") ? `0${intl.slice(3)}` : intl;
    profile = (await s.from("profiles").select("id,full_name,email,phone,phone_number,student_number,campus,course,profile_picture_url").or(`phone.eq.${intl},phone_number.eq.${intl},phone.eq.${local},phone_number.eq.${local}`).limit(1).maybeSingle()).data || null;
    if (profile && contactId && !contact?.profile_user_id) {
      await s.from("adminos_contacts").update({ profile_user_id: profile.id, full_name: contact?.full_name || profile.full_name, email: contact?.email || profile.email, student_number: contact?.student_number || profile.student_number, campus: contact?.campus || profile.campus, updated_at: new Date().toISOString() }).eq("id", contactId);
      contact = { ...(contact || {}), profile_user_id: profile.id };
    }
  }
  return { contact, profile };
}
async function state(s: any, thread: any, patch: any) {
  const next = { ...(thread.conversation_state || {}), ...patch };
  const update: any = { conversation_state: next, updated_at: new Date().toISOString() };
  if (patch.intent) update.intent = patch.intent;
  await s.from("adminos_whatsapp_threads").update(update).eq("id", thread.id);
  thread.conversation_state = next; if (patch.intent) thread.intent = patch.intent; return next;
}
async function setLanguage(s: any, thread: any, contactId: string | null, code: string, source = "selected", confidence = 1) {
  if (!LANGS.has(code)) return; thread.language_code = code;
  if (contactId) {
    const result = await s.rpc("adminos_set_contact_language", { p_contact_id: contactId, p_language_code: code, p_source: source, p_confidence: confidence });
    if (result.error) await s.from("adminos_whatsapp_threads").update({ language_code: code, updated_at: new Date().toISOString() }).eq("id", thread.id);
  } else await s.from("adminos_whatsapp_threads").update({ language_code: code, updated_at: new Date().toISOString() }).eq("id", thread.id);
}
async function phrase(s: any, key: string, code: string) {
  return (await s.from("adminos_i18n_phrases").select("phrase_text").eq("phrase_key", key).eq("language_code", code).maybeSingle()).data?.phrase_text || (await s.from("adminos_i18n_phrases").select("phrase_text").eq("phrase_key", key).eq("language_code", "en").maybeSingle()).data?.phrase_text || "Thank you.";
}
async function detectLanguage(s: any, thread: any, contactId: string | null, body: string) {
  if (!body.trim() || body.includes(":")) return thread.language_code || "en";
  const result = await s.rpc("adminos_detect_language", { p_text: body });
  const code = LANGS.has(String(result.data || "")) ? String(result.data) : "en";
  if (code !== "en" && code !== thread.language_code) await setLanguage(s, thread, contactId, code, "detected", 0.85);
  return code !== "en" ? code : thread.language_code || "en";
}
function selectionFrom(params: URLSearchParams, body: string) {
  const direct = text(params.get("ButtonPayload")); if (direct) return direct;
  const raw = text(params.get("InteractiveData")); if (raw) { try { const data = JSON.parse(raw); return text(data?.id || data?.payload || data?.button_payload || data?.selected_id) || body; } catch {} }
  return body;
}
async function touchConversion(s: any, thread: any, contactId: string | null, profile: any, intent: string, stage: string, patch: any = {}) {
  await s.rpc("adminos_touch_whatsapp_conversion", { p_thread_id: thread.id, p_contact_id: contactId, p_user_id: profile?.id || null, p_intent: intent, p_stage: stage, p_patch: patch });
}
async function saveFeedback(s: any, thread: any, contactId: string | null, messageId: string | null, contextKey: string | null, satisfied: boolean | null, score: number | null, feedbackText: string | null, language: string, metadata: any = {}) {
  await s.rpc("adminos_record_agent_feedback", { p_thread_id: thread.id, p_contact_id: contactId, p_source_message_id: messageId, p_context_key: contextKey, p_satisfied: satisfied, p_score: score, p_feedback_text: feedbackText, p_language_code: language, p_metadata: metadata });
}
async function learningGap(s: any, thread: any, contactId: string | null, question: string, reason: string, category = "knowledge_gap", metadata: any = {}) {
  await s.rpc("adminos_record_learning_gap", { p_question: question.slice(0, 4000), p_thread_id: thread.id, p_contact_id: contactId, p_reason: reason.slice(0, 2000), p_category: category, p_metadata: metadata });
}
async function resolvedReply(s: any, thread: any, contactId: string | null, from: string, body: string, contextKey: string, metadata: any = {}) {
  const next = await state(s, thread, { awaiting_satisfaction: true, awaiting_feedback_detail: false, satisfaction_context: contextKey });
  await sendText(s, thread, contactId, from, `${body}\n\nDid that fully solve what you needed? Reply Yes or No.`, { ...metadata, satisfaction_requested: true, satisfaction_context: contextKey });
  return next;
}

const greeting = (v: string) => /^(hi|hii+|hello|hey|good\s*(morning|afternoon|evening)|howzit|dumelang|dumela|sawubona|molo|hallo)[!.\s]*$/i.test(v.trim());
const menuRequest = (v: string) => /^(menu|start|main menu|options|help menu)[!.\s]*$/i.test(v.trim());
const accommodation = (v: string) => /\b(accommodation|student res|student residence|residence|room|rent|booking|book|secure accommodation|nsfas accommodation|tut accommodation|tvet accommodation|college accommodation|private tenant|2026 accommodation|2027 accommodation|indawo yokuhlala|madulo|bonno|bolulo|verblyf)\b/i.test(v);
const company = (v: string) => /\b(about reskonnect|what (do|does) (you|reskonnect) do|your services|company services|services do you offer|tell me about reskonnect|who are you)\b/i.test(v);
const enrollment = (v: string) => /\b(apply for (university|college|tut|enrolment|enrollment)|enrol|enroll|admission application|university application|college application|tvet application|course application|registration help|apply to tut|apply at tut)\b/i.test(v);
const nsfasHelp = (v: string) => /\b(nsfas application|apply for nsfas|nsfas funding|my nsfas|nsfas status|funding application)\b/i.test(v) && !/\b(accommodation|res|residence|room)\b/i.test(v);
const moreOptions = (v: string) => /\b(other options|more options|show more|different options|something else|other residences|more residences|next options)\b/i.test(v);
const satisfactionYes = (v: string) => /^(yes|yes thanks|yes thank you|yep|yeah|sorted|resolved|perfect|that helped|satisfied|all good)$/i.test(v.trim());
const satisfactionNo = (v: string) => /^(no|nope|not really|not yet|still need help|not satisfied|did not help|didn't help)$/i.test(v.trim());
const CAMPUS_ALIASES: [RegExp, string][] = [[/soshanguve\s*north|sosha\s*north/i, "Soshanguve North Campus"], [/soshanguve\s*south|sosha\s*south/i, "Soshanguve South Campus"], [/pretoria\s*(main|west)|main\s*campus/i, "Pretoria (Main Campus)"], [/arcadia/i, "Arcadia Campus"], [/arts?\s*campus/i, "Arts Campus"], [/mbombela|nelspruit/i, "Mbombela Campus"], [/polokwane/i, "Polokwane Campus"], [/ga\s*-?\s*rankuwa/i, "Ga-Rankuwa Campus"], [/giyani/i, "Giyani Campus"]];
function inferCampus(v: string) { for (const [rx, label] of CAMPUS_ALIASES) if (rx.test(v)) return label; return null; }
function inferFreeLocation(v: string) { const match = v.match(/\b(?:near|around|in|at)\s+([a-z][a-z\s-]{2,40}?)(?:\?|\.|,|$|\s+(?:campus|for|with|and|my|i\b))/i); return match?.[1]?.trim() || null; }
function inferBudget(v: string) { const x = v.replace(/,/g, ""); const match = x.match(/(?:budget|max|under|below|up to|r)\s*[:=-]?\s*r?\s*(\d{3,5})/i) || x.match(/r\s*(\d{3,5})/i); return match ? Number(match[1]) : null; }
function inferAccommodation(v: string, current: any = {}) {
  const x = v.toLowerCase(), patch: any = { ...current, intent: "accommodation" };
  if (/\b2027\b/.test(x)) patch.year = 2027; else if (/\b2026\b/.test(x)) patch.year = 2026;
  if (/\bnsfas\b/.test(x)) patch.funding = "nsfas"; else if (/bursary|sponsor/.test(x)) patch.funding = "bursary"; else if (/private funded|self[- ]?funded|cash|private paying/.test(x)) patch.funding = "private";
  if (/\btut\b/.test(x)) patch.institution = "tut"; else if (/tvet|college/.test(x)) patch.institution = "tvet";
  if (/private tenant|non[- ]?student/.test(x)) patch.tenant = "private"; else if (/\bstudent\b/.test(x)) patch.tenant = "student";
  if (/\bsingle\b|own room/.test(x)) patch.room_preference = "single"; else if (/sharing|shared|share room/.test(x)) patch.room_preference = "sharing";
  const campus = inferCampus(v); if (campus) patch.campus = campus; const budget = inferBudget(v); if (budget) patch.budget_max = budget;
  if (!patch.campus) { const location = inferFreeLocation(v); if (location) patch.location = location; }
  return patch;
}
function campusMatches(value: string, target: string) { const a = clean(value), b = clean(target); if (!b) return true; if (b.includes("pretoria main campus")) return a.includes("pretoria main") || a.includes("pretoria west") || a === "pretoria"; if (b.includes("soshanguve north")) return a.includes("soshanguve north"); if (b.includes("soshanguve south")) return a.includes("soshanguve south"); if (b.includes("ga rankuwa")) return a.includes("ga rankuwa"); return a.includes(b.replace(/ campus$/, "")); }
async function findMentionedResidence(s: any, body: string) {
  if (!/\b(interested|availability|booking|book|secure|reserve|this residence|this res)\b/i.test(body)) return null;
  const rows = (await s.from("residences").select("id,name,slug,campus,city,address,price,private_price,nsfas_price,available_spots,accepts_tvet,accepts_university,accepts_private,accepts_nsfas,is_tut_accredited,reservations_2027_open,cover_image_url,image_url,images,room_type,singles_available").or("is_visible.eq.true,is_visible.is.null").limit(600)).data || [];
  const hay = clean(body); return rows.sort((a: any, b: any) => String(b.name || "").length - String(a.name || "").length).find((r: any) => { const name = clean(r.name || ""); return name.length >= 4 && hay.includes(name); }) || null;
}
function residencePrice(r: any, st: any) { return st.funding === "nsfas" && r.nsfas_price ? r.nsfas_price : st.funding === "private" && r.private_price ? r.private_price : r.price; }
async function sendResidenceCard(s: any, thread: any, contactId: string | null, from: string, residence: any, st: any, index?: number) {
  const price = residencePrice(residence, st), location = [residence.campus, residence.city].filter(Boolean).join(" · ") || residence.address || "Location on listing";
  const body = [index ? `${index}. 🏠 ${residence.name}` : `🏠 ${residence.name}`, `📍 ${location}`, price ? `💳 R${Number(price).toLocaleString("en-ZA")}` : null, residence.available_spots != null ? `Availability: ${residence.available_spots} spot${Number(residence.available_spots) === 1 ? "" : "s"}` : null, residence.room_type ? `Room: ${residence.room_type}` : null, `View & apply: ${link(`/find-my-res/${residence.slug || residence.id}`)}`].filter(Boolean).join("\n");
  const image = text(residence.cover_image_url || residence.image_url || (Array.isArray(residence.images) ? residence.images[0] : ""));
  if (image) await sendMedia(s, thread, contactId, from, body, image, { residence_id: residence.id }); else await sendText(s, thread, contactId, from, body, { residence_id: residence.id, media_missing: true });
}
async function recordResidenceLead(s: any, thread: any, contactId: string | null, from: string, who: any, residence: any, st: any) {
  const phone = e164(from); const existing = (await s.from("residence_leads").select("id,stage").eq("residence_id", residence.id).eq("contact_phone", phone).neq("stage", "lost").order("created_at", { ascending: false }).limit(1)).data?.[0]; if (existing) return existing.id;
  const result = await s.from("residence_leads").insert({ residence_id: residence.id, user_id: who.profile?.id || null, source_type: "manual", source_id: thread.id, stage: "new", funding_type: st.funding || null, room_preference: st.room_preference || null, academic_year: st.year || null, contact_name: who.profile?.full_name || who.contact?.full_name || null, contact_phone: phone, contact_email: who.profile?.email || who.contact?.email || null, admin_notes: "WhatsApp interest captured automatically by Dimpho" }).select("id").single(); if (result.error) throw result.error; return result.data?.id || null;
}
async function secureResidence(s: any, thread: any, contactId: string | null, from: string, who: any, residence: any, st: any) {
  const leadId = await recordResidenceLead(s, thread, contactId, from, who, residence, st); await touchConversion(s, thread, contactId, who.profile, "accommodation", "lead_created", { ...st, selected_residence_id: residence.id, residence_lead_id: leadId });
  const year = Number(st.year || 2027);
  if (who.profile?.id && year >= 2027) {
    const funding = ["private", "nsfas"].includes(st.funding) ? st.funding : st.funding ? "other" : "undecided";
    const result = await s.from("accommodation_reservations").upsert({ user_id: who.profile.id, residence_id: residence.id, academic_year: year, funding_type: funding, room_preference: st.room_preference || null, status: "reserved", source: "whatsapp_dimpho", applicant_name: who.profile.full_name || who.contact?.full_name || null, notes: "Reservation interest created from WhatsApp via Dimpho" }, { onConflict: "user_id,residence_id,academic_year" }).select("id,status").single(); if (result.error) throw result.error;
    await touchConversion(s, thread, contactId, who.profile, "accommodation", "reservation_started", { ...st, selected_residence_id: residence.id, reservation_id: result.data?.id });
    await resolvedReply(s, thread, contactId, from, `I’ve recorded your ${year} reservation interest for ${residence.name}. This is not a final room allocation yet. Continue the secure application here: ${link(`/find-my-res/${residence.slug || residence.id}`)}`, "accommodation_reservation", { intent: "accommodation", conversion: "reservation_started", residence_id: residence.id }); return;
  }
  await resolvedReply(s, thread, contactId, from, `I’ve recorded your interest in ${residence.name} so the enquiry is not lost. To complete a secure reservation/application, sign in or create your ResKonnect profile here: ${link(`/find-my-res/${residence.slug || residence.id}`)}`, "accommodation_interest", { intent: "accommodation", conversion: "lead_created", residence_id: residence.id });
}
async function residenceMatches(s: any, thread: any, contactId: string | null, from: string, who: any, st: any, showMore = false) {
  let rows = (await s.from("residences").select("id,name,slug,campus,city,address,price,private_price,nsfas_price,available_spots,accepts_tvet,accepts_university,accepts_private,accepts_nsfas,is_tut_accredited,reservations_2027_open,cover_image_url,image_url,images,is_spotlight,is_featured,featured,trusted,is_trusted,data_quality_score,service_ready,room_type,singles_available").or("is_visible.eq.true,is_visible.is.null").limit(600)).data || [];
  rows = rows.filter((r: any) => Number(r.available_spots ?? 1) !== 0);
  if (st.campus) rows = rows.filter((r: any) => campusMatches(r.campus || r.city || r.address || "", st.campus)); else if (st.location) { const query = clean(st.location); rows = rows.filter((r: any) => clean([r.campus, r.city, r.address].filter(Boolean).join(" ")).includes(query)); }
  if (Number(st.year) === 2027) rows = rows.filter((r: any) => r.reservations_2027_open === true);
  if (st.institution === "tut") rows = rows.filter((r: any) => r.is_tut_accredited || r.accepts_university);
  if (st.institution === "tvet") rows = rows.filter((r: any) => r.accepts_tvet);
  if (st.funding === "nsfas") rows = rows.filter((r: any) => r.accepts_nsfas);
  if (st.funding === "private" || st.tenant === "private") rows = rows.filter((r: any) => r.accepts_private);
  if (st.room_preference === "single") rows = rows.filter((r: any) => Number(r.singles_available || 0) > 0 || /single/i.test(String(r.room_type || "")));
  if (Number(st.budget_max) > 0) rows = rows.filter((r: any) => { const price = Number(residencePrice(r, st) || 0); return !price || price <= Number(st.budget_max); });
  rows.sort((a: any, b: any) => Number(Boolean(b.is_spotlight)) - Number(Boolean(a.is_spotlight)) || Number(Boolean(b.is_featured || b.featured)) - Number(Boolean(a.is_featured || a.featured)) || Number(Boolean(b.service_ready)) - Number(Boolean(a.service_ready)) || Number(b.data_quality_score || 0) - Number(a.data_quality_score || 0));
  const alreadyShown = new Set<string>(Array.isArray(st.shown_residence_ids) ? st.shown_residence_ids.map(String) : []); const filtered = showMore ? rows.filter((r: any) => !alreadyShown.has(String(r.id))) : rows; const page = filtered.slice(0, 6);
  const signature = JSON.stringify({ campus: st.campus || st.location || null, year: st.year || null, funding: st.funding || null, institution: st.institution || null, tenant: st.tenant || null, room: st.room_preference || null, budget: st.budget_max || null, ids: page.map((r: any) => r.id) });
  if (!showMore && thread.conversation_state?.last_result_signature === signature) { await sendText(s, thread, contactId, from, "I’ve already shared those exact current matches, so I won’t duplicate them. Choose one of the residences already shown, ask for other options, or tell me which preference you want to change.", { intent: "accommodation", duplicate_prevented: true }); return page; }
  if (!page.length) { await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", st); await state(s, thread, { ...st, last_result_signature: signature, last_matches: [], awaiting_residence_selection: false }); const place = st.campus || st.location || "those exact preferences"; await sendText(s, thread, contactId, from, showMore ? `I don’t have additional published options beyond the residences already shown for ${place}. If you change campus, budget, funding or room type, I can search again.` : `I don’t currently have a published match for ${place}. I won’t send accommodation from the wrong campus just to fill the response. Browse all current listings here: ${link("/findmyres")}`, { intent: "accommodation", no_exact_match: true }); return []; }
  const mergedShown = Array.from(new Set([...alreadyShown, ...page.map((r: any) => String(r.id))])); const matchState = { ...st, last_result_signature: signature, last_matches: page.map((r: any, i: number) => ({ id: r.id, name: r.name, slug: r.slug, index: i + 1, campus: r.campus })), shown_residence_ids: mergedShown, awaiting_residence_selection: true };
  await state(s, thread, matchState); await touchConversion(s, thread, contactId, who.profile, "accommodation", "matched", matchState);
  await sendText(s, thread, contactId, from, showMore ? `Here are ${page.length} additional current option${page.length === 1 ? "" : "s"}.` : `I found ${page.length} current option${page.length === 1 ? "" : "s"}${st.campus ? ` for ${st.campus}` : ""}. Listings without photos are still included when their published details match.`, { intent: "accommodation", result_count: page.length, show_more: showMore });
  for (let i = 0; i < page.length; i++) await sendResidenceCard(s, thread, contactId, from, page[i], st, i + 1);
  return page;
}
function selectedFromState(st: any, body: string) { const matches = Array.isArray(st?.last_matches) ? st.last_matches : []; const number = Number(body.trim()); if (Number.isInteger(number) && number >= 1 && number <= matches.length) return matches[number - 1]; const query = clean(body); return matches.find((m: any) => { const name = clean(m.name || ""); return name.length >= 4 && (query === name || query.includes(name) || name.includes(query)); }) || null; }
async function fetchResidence(s: any, id: string) { return (await s.from("residences").select("id,name,slug,campus,city,address,price,private_price,nsfas_price,available_spots,accepts_tvet,accepts_university,accepts_private,accepts_nsfas,is_tut_accredited,reservations_2027_open,cover_image_url,image_url,images,room_type,singles_available").eq("id", id).maybeSingle()).data || null; }
async function applicationStatus(s: any, thread: any, contactId: string | null, from: string, profile: any) {
  if (!profile?.id) { await sendText(s, thread, contactId, from, `Sign in to securely track your ResKonnect application: ${link("/my-applications")}`); return false; }
  const app = (await s.from("applications").select("id,status,funding_type,move_in_date,residences(name,slug,cover_image_url,image_url)").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1)).data?.[0]; if (!app) { await sendText(s, thread, contactId, from, `I don’t see an accommodation application linked to this profile yet. Start with a residence here: ${link("/findmyres")}`); return false; }
  const residence: any = app.residences || {}, body = [`Application status: ${app.status || "Submitted"}`, residence.name ? `Residence: ${residence.name}` : null, app.funding_type ? `Funding: ${app.funding_type}` : null, `Next step: ${link("/my-applications")}`].filter(Boolean).join("\n"), image = text(residence.cover_image_url || residence.image_url);
  if (image) { await sendMedia(s, thread, contactId, from, body, image, { application_id: app.id }); await state(s, thread, { awaiting_satisfaction: true, awaiting_feedback_detail: false, satisfaction_context: "application_status" }); await sendText(s, thread, contactId, from, "Did that fully solve what you needed? Reply Yes or No.", { satisfaction_requested: true, satisfaction_context: "application_status" }); } else await resolvedReply(s, thread, contactId, from, body, "application_status", { application_id: app.id }); return true;
}
async function missingDocs(s: any, thread: any, contactId: string | null, from: string, profile: any) {
  if (!profile?.id) { await sendText(s, thread, contactId, from, `Sign in to view your secure application checklist: ${link("/my-applications")}`); return false; }
  const app = (await s.from("applications").select("id").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(1)).data?.[0]; if (!app) { await sendText(s, thread, contactId, from, `No accommodation application is linked to this profile yet: ${link("/findmyres")}`); return false; }
  const docs = (await s.from("application_documents").select("doc_type,status,rejection_reason").eq("application_id", app.id).in("status", ["rejected", "missing", "invalid", "needs_action"])).data || [];
  const body = !docs.length ? `I don’t see a recorded document issue on your latest application. Verify your checklist here: ${link("/my-applications")}` : `Your application needs attention on:\n${docs.slice(0, 8).map((d: any) => `• ${d.doc_type}: ${d.status}${d.rejection_reason ? ` — ${d.rejection_reason}` : ""}`).join("\n")}\n\nUpload sensitive documents securely: ${link("/my-applications")}`;
  await resolvedReply(s, thread, contactId, from, body, "application_documents", { application_id: app.id }); return true;
}
async function wilStatus(s: any, thread: any, contactId: string | null, from: string, profile: any) {
  if (!profile?.id) { await sendText(s, thread, contactId, from, `Sign in to track WIL securely: ${link("/wil")}`); return false; }
  const wil = (await s.from("wil_applications").select("id,status,course,wil_duration,funding_status,campus").eq("student_id", profile.id).order("created_at", { ascending: false }).limit(1)).data?.[0]; if (!wil) { await sendText(s, thread, contactId, from, `I don’t see a WIL application linked to this profile. Explore current opportunities: ${link("/opportunities")}`); return false; }
  await resolvedReply(s, thread, contactId, from, [`WIL status: ${wil.status}`, wil.course ? `Course: ${wil.course}` : null, wil.campus ? `Campus: ${wil.campus}` : null, wil.wil_duration ? `Duration: ${wil.wil_duration}` : null, `Next step: ${link("/wil")}`].filter(Boolean).join("\n"), "wil_status", { wil_application_id: wil.id }); return true;
}
async function handoff(s: any, thread: any, contactId: string | null, from: string, reason: string, profile: any = null, acknowledgement = true) {
  if (thread.mode === "human" || thread.mode === "escalated") return;
  if (acknowledgement) await sendText(s, thread, contactId, from, "This needs a ResKonnect team member. I’ve passed the conversation context across, so you won’t need to repeat yourself. I’ll stop here while a person takes over.", { intent: "human", escalation: true, reason });
  await s.from("adminos_whatsapp_threads").update({ status: "escalated", mode: "escalated", priority: "high", intent: "human", updated_at: new Date().toISOString() }).eq("id", thread.id); thread.mode = "escalated"; thread.status = "escalated";
  await touchConversion(s, thread, contactId, profile, thread.intent || "service", "human_handoff", { reason }); await s.from("adminos_automation_events").insert({ event_type: "whatsapp.escalated", entity_type: "whatsapp_thread", entity_id: thread.id, contact_id: contactId, payload: { reason, risk: "amber", persona: "Dimpho" } }); await activity(s, thread.id, "whatsapp.escalated", { reason });
}
async function routeDeterministic(s: any, input: any) {
  const { thread, contactId, from, body, messageId } = input, selection = text(input.selection || body), lower = selection.toLowerCase(), who = await identity(s, contactId, from), name = first(who.profile?.full_name || who.contact?.full_name || "there"), language = await detectLanguage(s, thread, contactId, body); let current = thread.conversation_state || {};
  if (current.awaiting_satisfaction && satisfactionYes(body)) { await saveFeedback(s, thread, contactId, messageId, current.satisfaction_context || null, true, 5, body, language, { source: "whatsapp_yes_no" }); await state(s, thread, { awaiting_satisfaction: false, awaiting_feedback_detail: false, satisfaction_context: null }); await touchConversion(s, thread, contactId, who.profile, thread.intent || "service", "converted", { satisfaction: true }); await sendText(s, thread, contactId, from, "Great — glad that’s sorted. If you need something else, just tell me what you need.", { intent: "satisfaction", satisfied: true }); return true; }
  if (current.awaiting_satisfaction && satisfactionNo(body)) { await saveFeedback(s, thread, contactId, messageId, current.satisfaction_context || null, false, 2, body, language, { source: "whatsapp_yes_no" }); await state(s, thread, { awaiting_satisfaction: false, awaiting_feedback_detail: true }); await sendText(s, thread, contactId, from, "Thanks for telling me. What was missing or still unclear? I’ll use that feedback to improve the service and try to resolve it properly.", { intent: "satisfaction", satisfied: false }); return true; }
  if (current.awaiting_feedback_detail && body.trim()) { await saveFeedback(s, thread, contactId, messageId, current.satisfaction_context || null, false, 2, body, language, { source: "whatsapp_detail" }); await learningGap(s, thread, contactId, body, "Customer said the previous assistance did not fully solve the request.", "customer_feedback", { satisfaction_context: current.satisfaction_context || null }); await state(s, thread, { awaiting_feedback_detail: false, awaiting_satisfaction: false, satisfaction_context: null }); current = thread.conversation_state || {}; }
  if (lower.startsWith("csat:")) { const score = Number(lower.split(":")[1]); if (score >= 1 && score <= 5) { const result = await s.rpc("adminos_record_csat", { p_thread_id: thread.id, p_score: score, p_source_message_id: messageId, p_comment: null, p_language: language }); if (result.error) throw result.error; await saveFeedback(s, thread, contactId, messageId, thread.intent || null, score >= 4, score, null, language, { source: "csat" }); await sendText(s, thread, contactId, from, await phrase(s, "csat_thanks", language), { intent: "csat", score }, false); await activity(s, thread.id, "csat.recorded", { score, language }); return true; } }
  if (lower === "menu:language" || /^(language|change language|puo|ulimi|taal)$/i.test(body.trim())) { await sendRich(s, thread, contactId, from, "rk_language_menu"); return true; }
  if (lower.startsWith("lang:")) { const code = lower.split(":")[1]; if (LANGS.has(code)) { await setLanguage(s, thread, contactId, code, "selected", 1); await sendText(s, thread, contactId, from, await phrase(s, "thanks", code), { intent: "language", language: code }); await sendMenuIfUseful(s, thread, contactId, from, menuForLanguage(code), { "1": name }, true); return true; } }
  if (menuRequest(body) || lower === "menu:main") { await s.from("adminos_whatsapp_threads").update({ mode: "ai_auto", status: "open", priority: "normal", intent: "main", updated_at: new Date().toISOString() }).eq("id", thread.id); thread.mode = "ai_auto"; await sendMenuIfUseful(s, thread, contactId, from, menuForLanguage(language), { "1": name }, true); return true; }
  if (greeting(body)) { await touchConversion(s, thread, contactId, who.profile, "service", "new", {}); await sendText(s, thread, contactId, from, `Hi ${name} 👋 I’m Dimpho, ResKonnect’s service assistant. Tell me what you need in one sentence — for example “NSFAS accommodation at Soshanguve North”, “help me apply to TUT”, or “I need WIL”. I’ll take you straight to the next step.`, { intent: "welcome" }); await sendMenuIfUseful(s, thread, contactId, from, menuForLanguage(language), { "1": name }); return true; }
  if (lower === "human:wait" || lower === "menu:human" || lower === "menu:partnerships" || /\b(partnership|partner with|business proposal|residence owner|landlord partnership|collaboration|sponsor|sponsorship|speak to (the )?(owner|director|manager|human|agent))\b/i.test(body)) { await handoff(s, thread, contactId, from, lower === "menu:partnerships" ? "partnership_or_business_enquiry" : "human_requested", who.profile, true); return true; }
  const mentioned = await findMentionedResidence(s, body); if (mentioned) { const st = await state(s, thread, inferAccommodation(body, current)); await sendResidenceCard(s, thread, contactId, from, mentioned, st); const leadId = await recordResidenceLead(s, thread, contactId, from, who, mentioned, st); await state(s, thread, { ...st, selected_residence_id: mentioned.id, selected_residence_name: mentioned.name, last_matches: [{ id: mentioned.id, name: mentioned.name, slug: mentioned.slug, index: 1, campus: mentioned.campus }], awaiting_residence_selection: false }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "lead_created", { ...st, selected_residence_id: mentioned.id, residence_lead_id: leadId }); if (/\b(secure|reserve|book|booking)\b/i.test(body)) await secureResidence(s, thread, contactId, from, who, mentioned, st); else await sendText(s, thread, contactId, from, `I’ve recorded your interest in ${mentioned.name}. If you want me to move this forward, reply “secure”.`, { intent: "accommodation", conversion_cta: true, residence_id: mentioned.id }); return true; }
  current = thread.conversation_state || {}; const selected = selectedFromState(current, body); if (selected) { const residence = await fetchResidence(s, selected.id); if (residence) { const st = await state(s, thread, { ...current, selected_residence_id: residence.id, selected_residence_name: residence.name, awaiting_residence_selection: false }); const leadId = await recordResidenceLead(s, thread, contactId, from, who, residence, st); await touchConversion(s, thread, contactId, who.profile, "accommodation", "lead_created", { ...st, selected_residence_id: residence.id, residence_lead_id: leadId }); await sendText(s, thread, contactId, from, `Great — I’ve recorded your interest in ${residence.name}. Reply “secure” to create the next reservation/application step, or view it here: ${link(`/find-my-res/${residence.slug || residence.id}`)}`, { intent: "accommodation", residence_id: residence.id }); return true; } }
  if (/^(secure|reserve|book|yes secure|secure it|i want it)$/i.test(body.trim()) && current.selected_residence_id) { const residence = await fetchResidence(s, current.selected_residence_id); if (residence) { await secureResidence(s, thread, contactId, from, who, residence, current); return true; } }
  if (moreOptions(body) && current.intent === "accommodation" && (current.campus || current.location)) { await residenceMatches(s, thread, contactId, from, who, current, true); return true; }
  if (nsfasHelp(body)) { await state(s, thread, { intent: "nsfas" }); await touchConversion(s, thread, contactId, who.profile, "nsfas", "nsfas_guidance", {}); await sendText(s, thread, contactId, from, `I can help you understand the NSFAS process and prepare your next steps, but ResKonnect does not submit or guarantee NSFAS funding applications. Use the official NSFAS service for the funding application/status: https://www.nsfas.org.za/ . For NSFAS-friendly accommodation, I can match you immediately: ${link("/student-accommodation/nsfas-accredited")}\n\nTell me which institution/campus you’re going to and I’ll guide the most useful next step.`, { intent: "nsfas", conversion_cta: true }); return true; }
  if (enrollment(body)) { const route = /tvet|college/i.test(body) ? "/applications/tvet" : "/applications/university"; await state(s, thread, { intent: "applications" }); await touchConversion(s, thread, contactId, who.profile, "enrollment", "enrollment_guidance", {}); await sendText(s, thread, contactId, from, `Yes — ResKonnect can help with application readiness, APS/course choices, document preparation and the correct application pathway. Final admission/submission remains with the institution. Start here: ${link(route)}\n\nTell me the institution and programme you want to apply for, and I’ll guide that exact next step.`, { intent: "applications", conversion_cta: true }); return true; }
  if (lower === "menu:applications") { await state(s, thread, { intent: "applications" }); await touchConversion(s, thread, contactId, who.profile, "applications", "qualified", {}); await sendRich(s, thread, contactId, from, "rk_application_menu_v3"); return true; }
  if (lower === "app:status") { await applicationStatus(s, thread, contactId, from, who.profile); await touchConversion(s, thread, contactId, who.profile, "applications", "application_started", {}); return true; }
  if (lower === "app:missing") { await missingDocs(s, thread, contactId, from, who.profile); await touchConversion(s, thread, contactId, who.profile, "applications", "application_started", {}); return true; }
  const appLinks: Record<string, string> = { "app:university": "/applications/university", "app:tvet": "/applications/tvet", "app:private-college": "/applications/private-college", "app:checker": "/applications/checker", "app:start": "/apply", "app:upload": "/my-applications" };
  if (appLinks[lower]) { await touchConversion(s, thread, contactId, who.profile, "applications", lower === "app:start" ? "application_started" : "enrollment_guidance", { action: lower }); await sendText(s, thread, contactId, from, `Your next step is here: ${link(appLinks[lower])}. If you tell me where you are stuck, I’ll guide that exact step rather than restart the menu.`, { intent: "applications", action: lower }); return true; }
  if (lower === "app:help") { await touchConversion(s, thread, contactId, who.profile, "applications", "qualified", {}); await sendText(s, thread, contactId, from, "Tell me the institution, programme and the exact step you need help with. I’ll guide one step at a time."); return true; }
  if (lower === "menu:opportunities") { await state(s, thread, { intent: "wil" }); await touchConversion(s, thread, contactId, who.profile, "wil", "qualified", {}); await sendRich(s, thread, contactId, from, "rk_wil_menu_v3"); return true; }
  if (lower === "wil:status") { await wilStatus(s, thread, contactId, from, who.profile); await touchConversion(s, thread, contactId, who.profile, "wil", "application_started", {}); return true; }
  const wilLinks: Record<string, string> = { "wil:apply": "/opportunities/wil", "wil:documents": "/wil", "wil:opportunities": "/opportunities" };
  if (wilLinks[lower]) { await touchConversion(s, thread, contactId, who.profile, "wil", "application_started", { action: lower }); await sendText(s, thread, contactId, from, `Continue here: ${link(wilLinks[lower])}. If you tell me your course and institution, I can narrow the next step.`, { intent: "wil", action: lower }); return true; }
  if (lower === "wil:requirements" || lower === "wil:placement" || lower === "wil:funding") { await touchConversion(s, thread, contactId, who.profile, "wil", "qualified", { action: lower }); await sendText(s, thread, contactId, from, "Tell me your institution, course and the exact WIL question. I’ll use verified information and only escalate protected placement decisions.", { intent: "wil", action: lower }); return true; }
  if (lower === "wil:employer") { await handoff(s, thread, contactId, from, "wil_employer_or_host_company", who.profile, true); return true; }
  if (lower === "menu:company" || lower === "menu:other" || company(body)) { await state(s, thread, { intent: "company" }); await touchConversion(s, thread, contactId, who.profile, "company", "qualified", {}); await sendText(s, thread, contactId, from, `ResKonnect helps with student accommodation and reservations, tertiary-application readiness, WIL/opportunities, landlord/property partnerships, and digital/AI-enabled service solutions. Tell me the outcome you want and I’ll take you to the relevant next step. ${PUBLIC_BASE}`, { intent: "company" }); return true; }
  if (lower === "company:about") { await resolvedReply(s, thread, contactId, from, `ResKonnect connects Living, Applications and Opportunities in one service platform. ${PUBLIC_BASE}`, "company_information"); return true; }
  if (lower === "company:living") { await sendText(s, thread, contactId, from, `Tell me the campus/area and funding type you need, or browse accommodation here: ${link("/living")}`); return true; }
  if (lower === "company:applications") { await sendText(s, thread, contactId, from, `Application readiness and tertiary guidance: ${link("/applications")}. Tell me the institution/programme and I’ll narrow the next step.`); return true; }
  if (lower === "company:opportunities") { await sendText(s, thread, contactId, from, `WIL and opportunities: ${link("/opportunities")}. Tell me your course/institution for a more relevant route.`); return true; }
  if (lower === "company:property") { await sendText(s, thread, contactId, from, `Property owners and residence operators can partner with ResKonnect here: ${link("/partners/landlords")}. If you want a partnership discussion, reply “partner”.`); return true; }
  if (lower === "company:ai") { await resolvedReply(s, thread, contactId, from, `ResKonnect uses automation and AI for faster support while protected decisions remain human-controlled. ${PUBLIC_BASE}`, "company_ai_services"); return true; }
  if (lower === "menu:technical") { await state(s, thread, { intent: "technical" }); await sendRich(s, thread, contactId, from, "rk_support_menu"); return true; }
  if (lower === "support:account") { await sendText(s, thread, contactId, from, `Use the secure sign-in/password-reset flow: ${link("/auth")} — never send passwords or OTPs in chat.`); return true; }
  if (lower === "support:technical") { await sendText(s, thread, contactId, from, "Tell me the page, what you expected and the exact error. I’ll troubleshoot routine issues and escalate account-level fixes with context."); return true; }
  if (lower === "menu:reservations" || lower === "menu:accommodation") { await state(s, thread, { intent: "accommodation", awaiting_residence_selection: false, awaiting_qualifier: "campus" }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", {}); await sendText(s, thread, contactId, from, "Tell me the campus or area you need first. I’ll match the live residence database and then help you secure one.", { intent: "accommodation", qualifier: "campus" }); return true; }
  if (lower === "acc:find") { await state(s, thread, { intent: "accommodation", awaiting_residence_selection: false, awaiting_qualifier: "campus" }); await sendText(s, thread, contactId, from, "Which campus or area do you need accommodation near?", { intent: "accommodation", qualifier: "campus" }); return true; }
  if (lower.startsWith("acc:year:")) { const st = await state(s, thread, { intent: "accommodation", year: Number(lower.split(":")[2]) || null, awaiting_qualifier: "funding", awaiting_residence_selection: false }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", st); await sendText(s, thread, contactId, from, "How will the accommodation be funded — NSFAS, bursary, private/self-funded, or not sure yet?", { intent: "accommodation", qualifier: "funding" }); return true; }
  if (lower.startsWith("acc:institution:")) { const st = await state(s, thread, { intent: "accommodation", institution: lower.split(":")[2], awaiting_qualifier: "campus", awaiting_residence_selection: false }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", st); await sendText(s, thread, contactId, from, "Which campus or area should I match the residence to?", { intent: "accommodation", qualifier: "campus" }); return true; }
  if (lower.startsWith("acc:funding:")) { const st = await state(s, thread, { intent: "accommodation", funding: lower.split(":")[2], awaiting_residence_selection: false, awaiting_qualifier: current.campus || current.location ? null : "campus" }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", st); if (st.campus || st.location) await residenceMatches(s, thread, contactId, from, who, st); else await sendText(s, thread, contactId, from, "Which campus or area do you need?", { intent: "accommodation", qualifier: "campus" }); return true; }
  if (lower.startsWith("acc:tenant:")) { const st = await state(s, thread, { intent: "accommodation", tenant: lower.split(":")[2], awaiting_residence_selection: false }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", st); if (st.campus || st.location) await residenceMatches(s, thread, contactId, from, who, st); else await sendText(s, thread, contactId, from, "Which campus or area do you need?", { intent: "accommodation", qualifier: "campus" }); return true; }
  const preferenceChange = Boolean(inferCampus(body)) || /\b(nsfas|private|self[- ]?funded|bursary|2026|2027|single|sharing|budget|under\s*r?\d|near|around)\b/i.test(body);
  if (accommodation(body) || (current.intent === "accommodation" && !current.awaiting_residence_selection) || (current.intent === "accommodation" && current.awaiting_residence_selection && preferenceChange)) { const resetShown = preferenceChange ? { shown_residence_ids: [], last_result_signature: null, last_matches: [] } : {}; const st = await state(s, thread, { ...inferAccommodation(body, current), ...resetShown, awaiting_residence_selection: false }); await touchConversion(s, thread, contactId, who.profile, "accommodation", "qualified", st); if (st.campus || st.location) await residenceMatches(s, thread, contactId, from, who, st); else if (st.funding && !st.campus) { await state(s, thread, { awaiting_qualifier: "campus" }); await sendText(s, thread, contactId, from, "Got it. Which campus or area do you need accommodation near?", { intent: "accommodation", qualifier: "campus" }); } else { await state(s, thread, { awaiting_qualifier: "campus" }); await sendText(s, thread, contactId, from, "I can help you secure accommodation. Which campus or area do you need first?", { intent: "accommodation", qualifier: "campus" }); } return true; }
  if (/\b(application status|track application|missing document|documents missing)\b/i.test(body)) { if (/missing|document/.test(lower)) await missingDocs(s, thread, contactId, from, who.profile); else await applicationStatus(s, thread, contactId, from, who.profile); await touchConversion(s, thread, contactId, who.profile, "applications", "application_started", {}); return true; }
  if (/\b(wil|work integrated learning|internship|placement|host company)\b/i.test(body)) { await touchConversion(s, thread, contactId, who.profile, "wil", "qualified", {}); await sendText(s, thread, contactId, from, `Tell me your institution and course, or open current opportunities here: ${link("/opportunities")}. I’ll guide the exact next step.`, { intent: "wil" }); return true; }
  if ((input.mediaCount || 0) > 0 && !body.trim()) { await sendText(s, thread, contactId, from, "I received your attachment and AdminOS is securing a private copy for the ResKonnect team. Tell me what this file relates to so I can continue the correct process. Do not send passwords, OTPs or banking credentials."); return true; }
  return false;
}
async function processInbound(s: any, input: any) {
  const { thread, contactId, from, body, messageId } = input;
  try {
    const prefs = contactId ? (await s.from("adminos_communication_preferences").select("do_not_contact,whatsapp_allowed").eq("contact_id", contactId).maybeSingle()).data : null;
    if ((prefs?.do_not_contact || prefs?.whatsapp_allowed === false) && !/^(start|subscribe|resume)$/i.test(body.trim())) return;
    if (/^(stop|unsubscribe|cancel messages|opt out)$/i.test(body.trim())) { if (contactId) { const existing = (await s.from("adminos_communication_preferences").select("id").eq("contact_id", contactId).maybeSingle()).data; if (existing) await s.from("adminos_communication_preferences").update({ do_not_contact: true, whatsapp_allowed: false, marketing_allowed: false, updated_at: new Date().toISOString() }).eq("id", existing.id); else await s.from("adminos_communication_preferences").insert({ contact_id: contactId, do_not_contact: true, whatsapp_allowed: false, marketing_allowed: false }); } await sendText(s, thread, contactId, from, "You’re opted out of ResKonnect WhatsApp automation.", { intent: "opt_out" }); return; }
    if (thread.mode === "human" || thread.mode === "escalated") { await s.from("adminos_automation_events").insert({ event_type: "whatsapp.human_mode_waiting", entity_type: "whatsapp_thread", entity_id: thread.id, contact_id: contactId, payload: { message_id: messageId, mode: thread.mode } }); await activity(s, thread.id, "human.awaiting_reply", { message_id: messageId, mode: thread.mode }); return; }
    if (await routeDeterministic(s, input)) return;
    const mode = thread.mode || "ai_auto", language = thread.language_code || "en", history = (await s.from("adminos_whatsapp_messages").select("direction,body_text,metadata,created_at").eq("thread_id", thread.id).order("created_at", { ascending: false }).limit(30)).data || [], who = await identity(s, contactId, from); await touchConversion(s, thread, contactId, who.profile, thread.intent || "general", "qualified", {});
    const response = await fetch(`${supabaseUrl}/functions/v1/adminos-agent`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" }, body: JSON.stringify({ action: "public_enquiry", message: body, contact_id: contactId, context: { channel: "whatsapp", preferred_language: language, verified_phone_contact: Boolean(contactId), conversation_history: history.reverse(), customer: who.contact || who.profile || null, conversation_state: thread.conversation_state || {}, canonical_website: PUBLIC_BASE, instruction: `You are Dimpho, ResKonnect's conversion-focused human-like service agent. Use the full conversation memory. Do not repeat a question, menu, residence set, explanation or action already completed unless the customer explicitly asks again. Resolve the actual request and give one best next action. If residence options were already supplied, do not send more residence options unless the customer asks for other options or changes preferences. If a human is required, say so once and stop: set escalate=true and do not continue with more troubleshooting, narrowing or selling. If you do not know or verified data is insufficient, admit that; never guess. ResKonnect does not submit or guarantee NSFAS funding applications, admission, room allocation or placement decisions. Use verified context only. All ResKonnect links must use https://www.reskonnect.org. Never invent availability, pricing, application status, funding outcomes or policy. Never request passwords, OTPs, banking details, identity numbers or sensitive documents in open WhatsApp.` } }) });
    const agent = await response.json().catch(() => ({})); if (!response.ok || !agent.answer) throw new Error(agent.error || `Agent HTTP ${response.status}`);
    const answer = String(agent.answer).replaceAll("https://reskonnect.org", PUBLIC_BASE).slice(0, 2000), reason = String(agent.reason || ""), confidence = Number(agent.confidence || 0);
    if (mode === "assist") { await s.from("adminos_whatsapp_drafts").update({ status: "superseded", updated_at: new Date().toISOString() }).eq("thread_id", thread.id).eq("status", "ready"); await s.from("adminos_whatsapp_drafts").insert({ thread_id: thread.id, source_message_id: messageId, body_text: answer, status: "ready", risk_level: ["green", "amber", "red"].includes(agent.risk) ? agent.risk : "amber", confidence: agent.confidence || null, agent_run_id: agent.run_id || null, metadata: { source: "assist_auto_draft", persona: "Dimpho" } }); return; }
    const needsHuman = agent.risk === "red" || Boolean(agent.escalate) || confidence < 0.55 || /\b(don't know|do not know|unknown|insufficient|not enough information|cannot verify|needs human|human review)\b/i.test(`${answer} ${reason}`);
    if (needsHuman) { await learningGap(s, thread, contactId, body, reason || "Dimpho could not safely resolve the enquiry from verified information.", agent.risk === "red" ? "protected_or_risk" : "knowledge_gap", { confidence, risk: agent.risk || "amber", agent_run_id: agent.run_id || null }); const acknowledgement = answer && !/\b(let'?s narrow|which campus|tell me more|choose an option)\b/i.test(answer) ? `${answer}\n\nI’m passing this to a ResKonnect team member now. I’ll stop here so automation does not get in the way.` : "I don’t have enough verified information to resolve this safely. I’m passing the full conversation to a ResKonnect team member now, and I’ll stop here so you don’t have to repeat yourself."; await sendText(s, thread, contactId, from, acknowledgement, { escalation: true, reason: reason || "agent_requested_escalation" }); await handoff(s, thread, contactId, from, reason || "agent_requested_escalation", who.profile, false); return; }
    const recentOutbound = history.filter((m: any) => m.direction === "outbound").slice(-5).map((m: any) => clean(m.body_text || "")); if (answer.length > 30 && recentOutbound.includes(clean(answer))) { await sendText(s, thread, contactId, from, "I’ve already covered that exact point, so I won’t repeat it. Tell me what changed or what you still need and I’ll continue from there.", { duplicate_prevented: true }); return; }
    const asksClarification = /\?$/.test(answer.trim()) || /\b(tell me|which |what |where |when |please confirm|could you confirm)\b/i.test(answer);
    if (asksClarification) await sendText(s, thread, contactId, from, answer, { risk: agent.risk || "green", confidence, agent_run_id: agent.run_id || null }); else await resolvedReply(s, thread, contactId, from, answer, thread.intent || "general_service", { risk: agent.risk || "green", confidence, agent_run_id: agent.run_id || null });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error); await learningGap(s, thread, contactId, body, reason, "automation_error", { message_id: messageId }).catch(() => null); await sendText(s, thread, contactId, from, "I couldn’t complete this safely through automation. I’ve passed the conversation to a ResKonnect team member and I’ll stop here so you don’t have to repeat yourself.", { escalation: true, system_error: true }).catch(() => null); await s.from("adminos_whatsapp_threads").update({ status: "escalated", mode: "escalated", priority: "high", updated_at: new Date().toISOString() }).eq("id", thread.id); await s.from("adminos_automation_events").insert({ event_type: "whatsapp.escalated", entity_type: "whatsapp_thread", entity_id: thread.id, contact_id: contactId, payload: { reason: "automation_error", error: reason, persona: "Dimpho" } }).catch(() => null); await activity(s, thread.id, "system.error", { reason, message_id: messageId });
  }
}
serve(async (req) => {
  if (req.method !== "POST") return xml(405); if (!supabaseUrl || !serviceKey) return xml(500);
  const raw = await req.text(), params = new URLSearchParams(raw), signed = await verifySignature(req, params), rest = signed ? false : await verifyRest(params); if (!signed && !rest) return xml(403); const authMode = signed ? "signature" : "rest_fallback", s = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }), sid = params.get("MessageSid") || params.get("SmsSid") || "", status = params.get("MessageStatus") || params.get("SmsStatus") || "", from = params.get("From") || "", to = params.get("To") || "", body = (params.get("Body") || "").slice(0, 12000);
  if (sid && status && !body.trim() && ["queued", "sent", "delivered", "read", "failed", "undelivered"].includes(status)) { const patch: any = { status }; if (status === "delivered" || status === "read") patch.delivered_at = new Date().toISOString(); await s.from("adminos_whatsapp_messages").update(patch).eq("twilio_message_sid", sid); await s.from("adminos_whatsapp_outbox").update({ status: ["failed", "undelivered"].includes(status) ? "failed" : "sent", last_error: ["failed", "undelivered"].includes(status) ? params.get("ErrorMessage") || params.get("ErrorCode") || status : null }).eq("twilio_message_sid", sid); return xml(); }
  if (!sid || !from) return xml(); const address = norm(from); if (!address) return xml();
  const resolved = await s.rpc("adminos_resolve_contact", { p_full_name: params.get("ProfileName") || null, p_email: null, p_phone: e164(from), p_profile_user_id: null, p_source_type: "whatsapp", p_source_id: null, p_metadata: { source: "twilio_whatsapp_inbound", twilio_sid: sid } }), contactId = resolved.data || null;
  let thread = (await s.from("adminos_whatsapp_threads").select("*").eq("normalized_address", address).maybeSingle()).data; if (!thread) { const created = await s.from("adminos_whatsapp_threads").insert({ contact_id: contactId, channel_address: wa(from), normalized_address: address, status: "open", mode: "ai_auto", language_code: "en", metadata: { source: "twilio" } }).select("*").single(); thread = created.data; } if (!thread) return xml();
  const mediaCount = Math.max(0, Math.min(10, Number(params.get("NumMedia") || 0))), media: any[] = []; for (let i = 0; i < mediaCount; i++) media.push({ url: params.get(`MediaUrl${i}`), content_type: params.get(`MediaContentType${i}`), name: `WhatsApp attachment ${i + 1}` });
  const selection = selectionFrom(params, body), isCsat = /^csat:[1-5]$/i.test(selection), now = new Date(), nowIso = now.toISOString(), expires = new Date(now.getTime() + 86_400_000).toISOString();
  const inserted = await s.from("adminos_whatsapp_messages").upsert({ thread_id: thread.id, contact_id: contactId, twilio_message_sid: sid, direction: "inbound", from_address: wa(from), to_address: wa(to), body_text: body || params.get("ButtonText") || selection || null, media, message_kind: "service", status: "received", received_at: nowIso, metadata: { account_sid: params.get("AccountSid"), profile_name: params.get("ProfileName") || null, author_type: "contact", auth_mode: authMode, button_payload: params.get("ButtonPayload") || null, button_text: params.get("ButtonText") || null, interactive_data: params.get("InteractiveData") || null, selection } }, { onConflict: "twilio_message_sid" }).select("id").maybeSingle(); if (!inserted.data) return xml();
  const modeBefore = thread.mode || "ai_auto", reopened = modeBefore === "closed" && !isCsat ? "ai_auto" : modeBefore, patch: any = { contact_id: contactId || thread.contact_id, last_message_at: nowIso, last_inbound_at: nowIso, customer_window_expires_at: expires, unread_count: Number(thread.unread_count || 0) + 1, updated_at: nowIso }; if (!isCsat && !["human", "escalated"].includes(modeBefore)) Object.assign(patch, { status: "open", mode: reopened, resolved_at: null, resolved_by: null }); await s.from("adminos_whatsapp_threads").update(patch).eq("id", thread.id);
  await s.from("adminos_automation_events").insert({ event_type: "whatsapp.received", entity_type: "whatsapp_thread", entity_id: thread.id, contact_id: contactId, payload: { message_id: inserted.data.id, message_sid: sid, body: body.slice(0, 1000), selection, media_count: mediaCount, auth_mode: authMode } }); await activity(s, thread.id, "message.received", { message_id: inserted.data.id, message_sid: sid, selection, media_count: mediaCount });
  EdgeRuntime.waitUntil(processInbound(s, { thread: { ...thread, mode: modeBefore, customer_window_expires_at: expires }, contactId, from, body: body || params.get("ButtonText") || selection || "", selection, messageId: inserted.data.id, authMode, mediaCount })); return xml();
});
