import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env = (name: string) => Deno.env.get(name) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const anonKey = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

const allowedOrigins = new Set([
  "https://www.reskonnect.org",
  "https://reskonnect.org",
  "http://localhost:8080",
  "http://localhost:5173",
]);

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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!supabaseUrl || !anonKey || !serviceKey) return json(req, { error: "Push service unavailable" }, 503);

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(req, { error: "Authentication required" }, 401);

  const auth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await auth.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return json(req, { error: "Authentication required" }, 401);

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "upsert");

  if (action === "remove") {
    const endpoint = String(body?.endpoint || "").trim();
    if (!endpoint) return json(req, { error: "Endpoint required" }, 400);
    const { error } = await service
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", user.id);
    if (error) return json(req, { error: "Could not remove subscription" }, 500);
    return json(req, { ok: true });
  }

  const endpoint = String(body?.endpoint || "").trim();
  const p256dh = String(body?.p256dh || "").trim();
  const authKey = String(body?.auth || "").trim();
  const userAgent = String(body?.user_agent || "").slice(0, 1000);

  if (!endpoint.startsWith("https://") || endpoint.length > 4096) {
    return json(req, { error: "Invalid push endpoint" }, 400);
  }
  if (!p256dh || p256dh.length > 1024 || !authKey || authKey.length > 1024) {
    return json(req, { error: "Invalid push keys" }, 400);
  }

  const { error } = await service.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint,
    p256dh,
    auth: authKey,
    user_agent: userAgent || null,
  }, { onConflict: "endpoint" });

  if (error) {
    console.error("push-subscription upsert failed", error);
    return json(req, { error: "Could not save notification subscription" }, 500);
  }

  return json(req, { ok: true });
});
