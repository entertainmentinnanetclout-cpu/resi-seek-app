import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (key: string) => Deno.env.get(key) || "";
const supabaseUrl = env("SUPABASE_URL") || env("EXTERNAL_SUPABASE_URL");
const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");
const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const allowedOrigins = new Set([
  "https://www.reskonnect.org",
  "https://reskonnect.org",
  "http://localhost:8080",
]);

const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://www.reskonnect.org",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const cleanText = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return json(req, { error: "backend_not_configured" }, 503);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(req, { error: "authentication_required" }, 401);

  const { data: userData, error: userError } = await service.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json(req, { error: "authentication_required" }, 401);

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const declaredProvider = cleanText(user.app_metadata?.provider) || cleanText(identities[0]?.provider) || "email";
  const matchingIdentity = identities.find((identity) => identity.provider === declaredProvider) || identities[0];
  const providerSubject =
    cleanText(matchingIdentity?.identity_data?.sub) ||
    cleanText(matchingIdentity?.id) ||
    cleanText(user.user_metadata?.sub);

  const googleOrProviderName =
    cleanText(user.user_metadata?.full_name) ||
    cleanText(user.user_metadata?.name);
  const providerAvatar =
    cleanText(user.user_metadata?.avatar_url) ||
    cleanText(user.user_metadata?.picture);
  const emailVerifiedAt = user.email_confirmed_at || null;
  const syncedAt = new Date().toISOString();

  const { data: existing, error: profileReadError } = await service
    .from("profiles")
    .select("id,full_name,profile_picture_url,phone_verified_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profileReadError) {
    console.error("identity-sync profile read failed", profileReadError);
    return json(req, { error: "identity_sync_failed" }, 500);
  }

  const securityLevel = existing?.phone_verified_at
    ? "contact_verified"
    : emailVerifiedAt
      ? "email_verified"
      : "basic";

  const authoritative = {
    email: user.email || "",
    full_name: cleanText(existing?.full_name) || googleOrProviderName || "",
    profile_picture_url: cleanText(existing?.profile_picture_url) || providerAvatar,
    auth_provider: declaredProvider,
    auth_provider_subject: providerSubject,
    email_verified_at: emailVerifiedAt,
    identity_synced_at: syncedAt,
    last_login_at: user.last_sign_in_at || syncedAt,
    security_level: securityLevel,
    updated_at: syncedAt,
  };

  let writeError = null;
  if (existing?.id) {
    const result = await service.from("profiles").update(authoritative).eq("id", user.id);
    writeError = result.error;
  } else {
    const result = await service.from("profiles").insert({ id: user.id, ...authoritative });
    writeError = result.error;
    if (!writeError) {
      await service.from("user_roles").upsert(
        { user_id: user.id, role: "student" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }
  }

  if (writeError) {
    console.error("identity-sync profile write failed", writeError);
    return json(req, { error: "identity_sync_failed" }, 500);
  }

  const { error: eventError } = await service.from("user_security_events").insert({
    user_id: user.id,
    event_type: "identity.session_synced",
    risk_level: "low",
    outcome: "allowed",
    metadata: {
      provider: declaredProvider,
      email_verified: Boolean(emailVerifiedAt),
      provider_profile_present: Boolean(googleOrProviderName || providerAvatar),
    },
  });
  if (eventError) console.warn("identity-sync event log failed", eventError.message);

  return json(req, {
    ok: true,
    provider: declaredProvider,
    identity_synced_at: syncedAt,
    security_level: securityLevel,
  });
});
