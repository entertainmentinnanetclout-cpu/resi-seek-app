import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env = (name: string) => Deno.env.get(name) || "";
const SUPABASE_URL = env("EXTERNAL_SUPABASE_URL") || env("SUPABASE_URL");
const ANON_KEY = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const SERVICE_KEY = env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC = env("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = env("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = env("VAPID_SUBJECT") || "mailto:reskonnect@gmail.com";

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
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

const ALLOWED_STAFF = new Set(["admin", "operations_lead", "system_operator", "support_agent", "growth_lead"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json(req, { error: "Push service unavailable" }, 503);
  }

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
    const url = String(body?.url || "/").trim();
    const requestedIds = Array.isArray(body?.user_ids)
      ? body.user_ids.filter((id: unknown) => typeof id === "string")
      : (typeof body?.user_id === "string" ? [body.user_id] : []);

    if (!title || title.length > 180) return json(req, { error: "Valid title required" }, 400);
    if (text.length > 1000) return json(req, { error: "Notification body too long" }, 400);

    let query = service.from("push_subscriptions").select("endpoint,p256dh,auth,user_id");
    if (requestedIds.length) query = query.in("user_id", requestedIds);
    const { data: subscriptions, error } = await query;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: text, url: url.startsWith("/") ? url : "/" });
    const rows = subscriptions || [];
    const results = await Promise.allSettled(rows.map((subscription: any) =>
      webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
      )
    ));

    const dead: string[] = [];
    results.forEach((result, index) => {
      if (result.status !== "rejected") return;
      const code = (result.reason as any)?.statusCode;
      if (code === 404 || code === 410) dead.push((rows as any[])[index]?.endpoint);
    });
    if (dead.length) await service.from("push_subscriptions").delete().in("endpoint", dead);

    return json(req, {
      sent: results.filter((result) => result.status === "fulfilled").length,
      failed: results.filter((result) => result.status === "rejected").length,
      pruned: dead.length,
    });
  } catch (error) {
    console.error("send-push failed", error);
    return json(req, { error: "Push delivery failed" }, 500);
  }
});
