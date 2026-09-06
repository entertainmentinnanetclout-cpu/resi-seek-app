import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const accountSid = env("TWILIO_ACCOUNT_SID");
const authToken = env("TWILIO_AUTH_TOKEN");
const bucket = "adminos-whatsapp-media";
const maxBytes = 20 * 1024 * 1024;
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const basic = () => `Basic ${btoa(`${accountSid}:${authToken}`)}`;

async function authorized(req: Request, service: any) {
  const token = req.headers.get("x-adminos-cron-token") || "";
  if (!token) return false;
  const row = await service.from("adminos_scheduler_secrets").select("secret_value").eq("secret_key", "whatsapp_event_worker").maybeSingle();
  const expected = String(row.data?.secret_value || "");
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function extensionFor(type: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[type] || "bin";
}

function safeName(value: string, fallback: string) {
  const cleaned = String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100);
  return cleaned || fallback;
}

async function fetchTwilioMedia(url: string) {
  if (!accountSid || !authToken) throw new Error("Twilio media credentials are not configured");
  const response = await fetch(url, { headers: { Authorization: basic() }, redirect: "follow" });
  if (!response.ok) throw new Error(`Twilio media HTTP ${response.status}`);
  const type = String(response.headers.get("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!allowed.has(type)) throw new Error(`Unsupported WhatsApp media type: ${type}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error("WhatsApp media exceeds the 20MB archive limit");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("WhatsApp media exceeds the 20MB archive limit");
  return { bytes, type };
}

async function archiveMessage(service: any, queue: any) {
  const messageRes = await service.from("adminos_whatsapp_messages").select("id,thread_id,direction,media,created_at").eq("id", queue.message_id).maybeSingle();
  if (messageRes.error) throw messageRes.error;
  const message = messageRes.data;
  if (!message) return { status: "blocked", reason: "message_not_found" };
  const media = Array.isArray(message.media) ? message.media : [];
  if (!media.length) return { status: "archived", archived: 0 };

  const normalized: any[] = [];
  let archived = 0;
  for (let index = 0; index < media.length; index++) {
    const item = media[index] || {};
    if (item.storage_path) {
      normalized.push(item);
      continue;
    }
    const sourceUrl = String(item.url || "").trim();
    if (!sourceUrl) {
      normalized.push({ ...item, archive_error: "source_url_missing" });
      continue;
    }
    const { bytes, type } = await fetchTwilioMedia(sourceUrl);
    const preferredName = safeName(item.name || `attachment-${index + 1}.${extensionFor(type)}`, `attachment-${index + 1}.${extensionFor(type)}`);
    const path = `inbound/${message.thread_id}/${message.id}/${index}-${preferredName}`;
    const upload = await service.storage.from(bucket).upload(path, bytes, { contentType: type, upsert: true, cacheControl: "3600" });
    if (upload.error) throw upload.error;

    const fileRow = await service.from("adminos_whatsapp_media_files").upsert({
      message_id: message.id,
      thread_id: message.thread_id,
      direction: "inbound",
      storage_bucket: bucket,
      storage_path: path,
      original_name: preferredName,
      content_type: type,
      size_bytes: bytes.byteLength,
      media_index: index,
    }, { onConflict: "storage_path" });
    if (fileRow.error) throw fileRow.error;

    normalized.push({
      storage_bucket: bucket,
      storage_path: path,
      content_type: type,
      name: preferredName,
      size_bytes: bytes.byteLength,
      archived_at: new Date().toISOString(),
      source: "twilio_archived",
    });
    archived += 1;
  }

  const update = await service.from("adminos_whatsapp_messages").update({ media: normalized }).eq("id", message.id);
  if (update.error) throw update.error;
  return { status: "archived", archived };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase runtime is not configured" }, 500);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!(await authorized(req, service))) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (String(body.action || "tick") !== "tick") return json({ error: "Unsupported action" }, 400);
  const limit = Math.max(1, Math.min(50, Number(body.max || 20)));
  const due = await service.from("adminos_whatsapp_media_archive_queue")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (due.error) return json({ error: due.error.message }, 500);

  const results: any[] = [];
  for (const item of due.data || []) {
    const attempts = Number(item.attempts || 0) + 1;
    await service.from("adminos_whatsapp_media_archive_queue").update({ status: "processing", attempts, updated_at: new Date().toISOString() }).eq("id", item.id);
    try {
      const result = await archiveMessage(service, item);
      await service.from("adminos_whatsapp_media_archive_queue").update({
        status: result.status,
        processed_at: new Date().toISOString(),
        last_error: result.reason || null,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      results.push({ id: item.id, message_id: item.message_id, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const blocked = attempts >= 6;
      await service.from("adminos_whatsapp_media_archive_queue").update({
        status: blocked ? "blocked" : "failed",
        available_at: new Date(Date.now() + Math.min(60, attempts * 5) * 60_000).toISOString(),
        last_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", item.id);
      results.push({ id: item.id, message_id: item.message_id, status: blocked ? "blocked" : "failed", error: message });
    }
  }
  return json({ ok: true, processed: results.length, results });
});