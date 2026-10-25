import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TOKEN_RE = /^[0-9a-f]{64}$/;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, count: 0 }), {
      status: 405,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token.trim().toLowerCase() : "";
  } catch {
    return new Response(JSON.stringify({ ok: false, count: 0 }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  if (!TOKEN_RE.test(token) || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ ok: false, count: 0 }), {
      status: TOKEN_RE.test(token) ? 503 : 401,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const upstream = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rk_poll_background_notifications`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ p_token: token }),
  });

  if (!upstream.ok) {
    console.error("native-notification-poll rpc failed", upstream.status);
    return new Response(JSON.stringify({ ok: false, count: 0 }), {
      status: 502,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const result = await upstream.json();
  const count = Number(result?.count ?? 0);
  return new Response(JSON.stringify({
    ok: result?.ok === true,
    count: Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), 99) : 0,
    has_updates: result?.has_updates === true,
  }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
});
