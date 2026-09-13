import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const env = (name: string) => Deno.env.get(name) || "";
const SUPABASE_URL = env("EXTERNAL_SUPABASE_URL") || env("SUPABASE_URL");
const ANON_KEY = env("SUPABASE_ANON_KEY") || env("EXTERNAL_SUPABASE_ANON_KEY");
const SERVICE_KEY = env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");

const cors = {
  "Access-Control-Allow-Origin": "https://www.reskonnect.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error("Referral service unavailable");
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const { code } = await req.json().catch(() => ({}));
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,64}$/.test(normalizedCode)) {
      return new Response(JSON.stringify({ error: "Valid referral code required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const service = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await service.rpc("capture_referral", {
      _code: normalizedCode,
      _referred: authData.user.id,
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("referral-capture failed", error);
    return new Response(JSON.stringify({ error: "Referral capture unavailable" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
