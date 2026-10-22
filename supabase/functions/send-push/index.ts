import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env = (name: string) => Deno.env.get(name) || "";
const SUPABASE_URL = env("EXTERNAL_SUPABASE_URL") || env("SUPABASE_URL");
const ANON_KEY = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const SERVICE_KEY = env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC = env("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = env("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = env("VAPID_SUBJECT") || "mailto:reskonnect@gmail.com";
const FIREBASE_SERVICE_ACCOUNT_JSON = env("FIREBASE_SERVICE_ACCOUNT_JSON");

if (VAPID_PUBLIC && VAPID_PRIVATE) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const allowedOrigins = new Set(["https://www.reskonnect.org", "https://reskonnect.org"]);
const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.reskonnect.org",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });

const ALLOWED_STAFF = new Set([
  "admin", "super_admin", "developer", "owner", "operations_lead", "system_operator", "support_agent", "growth_lead",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeRoute(value: unknown) {
  const route = String(value || "/dashboard/updates").trim();
  if (!route.startsWith("/") || route.startsWith("//") || route.startsWith("/_") || route.startsWith("/api/") || route.length > 1200) return "/dashboard/updates";
  return route;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}
function pemToPkcs8(pem: string) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

type FirebaseServiceAccount = { project_id: string; client_email: string; private_key: string };
let firebaseAccount: FirebaseServiceAccount | null | undefined;
let cachedAccess: { token: string; expiresAt: number } | null = null;

function getFirebaseAccount() {
  if (firebaseAccount !== undefined) return firebaseAccount;
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) return (firebaseAccount = null);
  try {
    const parsed = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) return (firebaseAccount = null);
    firebaseAccount = parsed as FirebaseServiceAccount;
  } catch {
    firebaseAccount = null;
  }
  return firebaseAccount;
}

async function firebaseAccessToken() {
  if (cachedAccess && cachedAccess.expiresAt - Date.now() > 120_000) return cachedAccess.token;
  const account = getFirebaseAccount();
  if (!account) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = textToBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = textToBase64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error(`Firebase OAuth failed (${response.status})`);
  const body = await response.json();
  const token = String(body?.access_token || "");
  const expiresIn = Math.max(300, Number(body?.expires_in || 3600));
  if (!token) throw new Error("Firebase OAuth returned no access token");
  cachedAccess = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

async function sendFcm(token: string, route: string) {
  const account = getFirebaseAccount();
  const accessToken = await firebaseAccessToken();
  if (!account || !accessToken) return { ok: false, unavailable: true, dead: false };
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: "ResKonnect update", body: "Tap to view your latest account update." },
        data: { route },
        android: {
          priority: "high",
          notification: { channel_id: "reskonnect_updates", default_vibrate_timings: true },
        },
      },
    }),
  });
  if (response.ok) return { ok: true, unavailable: false, dead: false };
  const errorText = await response.text().catch(() => "");
  const dead = response.status === 404 || /UNREGISTERED|registration token is not registered/i.test(errorText);
  console.warn("FCM delivery failed", response.status, errorText.slice(0, 300));
  return { ok: false, unavailable: false, dead };
}

async function inChunks<T>(rows: T[], size: number, run: (row: T) => Promise<void>) {
  for (let index = 0; index < rows.length; index += size) {
    await Promise.all(rows.slice(index, index + size).map(run));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) return json(req, { error: "Push service unavailable" }, 503);

  const webEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
  const fcmEnabled = Boolean(getFirebaseAccount());
  if (!webEnabled && !fcmEnabled) return json(req, { error: "No push transport is configured" }, 503);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    let authorized = bearer === SERVICE_KEY;
    const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    if (!authorized && bearer) {
      const authClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData } = await authClient.auth.getUser();
      const user = authData?.user;
      if (user) {
        const { data: role } = await service.rpc("get_user_staff_role", { _user_id: user.id });
        authorized = ALLOWED_STAFF.has(String(role || ""));
      }
    }
    if (!authorized) return json(req, { error: "Staff authorization required" }, 403);

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    const text = String(body?.body || "").trim();
    const route = safeRoute(body?.url || body?.route);
    const requestedIds = (Array.isArray(body?.user_ids) ? body.user_ids : (body?.user_id ? [body.user_id] : []))
      .filter((id: unknown): id is string => typeof id === "string" && UUID.test(id));
    if (!title || title.length > 180) return json(req, { error: "Valid title required" }, 400);
    if (text.length > 1000) return json(req, { error: "Notification body too long" }, 400);

    let webRows: any[] = [];
    if (webEnabled) {
      let query = service.from("push_subscriptions").select("endpoint,p256dh,auth,user_id");
      if (requestedIds.length) query = query.in("user_id", requestedIds);
      const { data, error } = await query;
      if (error) throw error;
      webRows = data || [];
    }

    let nativeRows: any[] = [];
    if (fcmEnabled) {
      let query = service.from("rk_native_device_tokens").select("token,user_id").eq("platform", "android");
      if (requestedIds.length) query = query.in("user_id", requestedIds);
      const { data, error } = await query;
      if (error) throw error;
      nativeRows = data || [];
    }

    const webPayload = JSON.stringify({ title, body: text, url: route });
    let webSent = 0;
    let webFailed = 0;
    const deadWeb: string[] = [];
    await inChunks(webRows, 100, async (subscription: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          webPayload,
        );
        webSent += 1;
      } catch (error) {
        webFailed += 1;
        const code = (error as any)?.statusCode;
        if (code === 404 || code === 410) deadWeb.push(subscription.endpoint);
      }
    });
    if (deadWeb.length) await service.from("push_subscriptions").delete().in("endpoint", deadWeb);

    let nativeSent = 0;
    let nativeFailed = 0;
    const deadNative: string[] = [];
    const successfulNative: string[] = [];
    await inChunks(nativeRows, 100, async (row: any) => {
      const result = await sendFcm(String(row.token), route);
      if (result.ok) {
        nativeSent += 1;
        successfulNative.push(String(row.token));
      } else if (!result.unavailable) {
        nativeFailed += 1;
        if (result.dead) deadNative.push(String(row.token));
      }
    });
    if (successfulNative.length) await service.from("rk_native_device_tokens").update({ last_success_at: new Date().toISOString() }).in("token", successfulNative);
    if (deadNative.length) await service.from("rk_native_device_tokens").delete().in("token", deadNative);

    return json(req, {
      web: { configured: webEnabled, sent: webSent, failed: webFailed, pruned: deadWeb.length },
      android: { configured: fcmEnabled, sent: nativeSent, failed: nativeFailed, pruned: deadNative.length },
    });
  } catch (error) {
    console.error("send-push failed", error);
    return json(req, { error: "Push delivery failed" }, 500);
  }
});
