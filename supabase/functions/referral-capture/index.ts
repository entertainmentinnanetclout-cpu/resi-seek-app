import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") || "";

const headers = {
  "Access-Control-Allow-Origin": "https://www.reskonnect.org",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...headers, "Content-Type": "application/json" } });
  if (!url || !anon) return new Response(JSON.stringify({ error: "Referral service unavailable" }), { status: 503, headers: { ...headers, "Content-Type": "application/json" } });

  const authorization = req.headers.get("Authorization") || "";
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = await req.json().catch(() => ({}));
  const code = String(body?.code || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,64}$/.test(code)) {
    return new Response(JSON.stringify({ error: "Valid referral code required" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
  }

  const { error } = await client.rpc("capture_referral_for_current_user", { _code: code });
  if (error) {
    console.error("referral capture failed", error);
    return new Response(JSON.stringify({ error: "Referral capture unavailable" }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, "Content-Type": "application/json" } });
});
