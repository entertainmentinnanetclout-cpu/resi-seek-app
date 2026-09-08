import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200, cache = "no-store") => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!url || !serviceKey) return json({ error: "Service unavailable" }, 503);

    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "network");
    const requestedDays = Number(body?.days || 90);
    const days = [30, 90, 365].includes(requestedDays) ? requestedDays : 90;

    if (action === "network") {
      const [supply, demand, institutions, opportunities] = await Promise.all([
        service.rpc("housing_intel_supply_live"),
        service.rpc("housing_intel_demand_heat", { p_days: days }),
        service.rpc("housing_intel_institution_snapshot", { p_days: days }),
        service.rpc("housing_intel_opportunities", { p_days: days }),
      ]);
      const error = supply.error || demand.error || institutions.error || opportunities.error;
      if (error) throw error;
      return json({
        release: 5,
        days,
        generated_at: new Date().toISOString(),
        supply: supply.data || [],
        demand: demand.data || [],
        institutions: institutions.data || [],
        opportunities: opportunities.data || [],
        methodology: {
          supply: "Published mapped residence supply and reported availability",
          demand: "Aggregate applications, non-cancelled reservations, explicit accommodation requests and ResMap activity",
          privacy: "Aggregate campus-level output only; no student PII",
          investment: "Screening signal only; not financial advice or a return forecast",
        },
      }, 200, "public, max-age=20, s-maxage=60, stale-while-revalidate=120");
    }

    if (action === "property_partner") {
      const residenceId = String(body?.residence_id || "");
      if (!/^[0-9a-f-]{36}$/i.test(residenceId)) return json({ error: "Valid residence_id required" }, 400);
      const auth = req.headers.get("Authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ error: "Authentication required" }, 401);
      const { data: userData, error: userError } = await service.auth.getUser(token);
      if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

      const partner = await service.rpc("housing_intel_property_partner_service", {
        p_residence_id: residenceId,
        p_user_id: userData.user.id,
        p_days: days,
      });
      if (partner.error) {
        const forbidden = /not authorized/i.test(partner.error.message || "");
        return json({ error: forbidden ? "Not authorized for this residence" : "Partner intelligence unavailable" }, forbidden ? 403 : 500);
      }
      return json({ release: 5, days, generated_at: new Date().toISOString(), partner: partner.data }, 200, "private, no-store");
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("housing-intelligence", error);
    return json({ error: "Housing intelligence is temporarily unavailable" }, 500);
  }
});
