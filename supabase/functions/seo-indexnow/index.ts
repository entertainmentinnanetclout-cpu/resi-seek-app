import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = "https://www.reskonnect.org";
const HOST = "www.reskonnect.org";
const INDEXNOW_KEY = "b34d7ea1e1d996f54f3aa0e8b1418041";
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const STAFF_ROLES = new Set(["admin", "operations_lead", "growth_lead", "system_operator"]);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: role, error: roleError } = await userClient.rpc("get_my_role");
  if (roleError || !STAFF_ROLES.has(String(role))) {
    return Response.json({ error: "Staff role required" }, { status: 403 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: rows, error } = await admin
    .from("seo_index_queue")
    .select("id,path,attempts")
    .eq("status", "pending")
    .order("queued_at", { ascending: true })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return Response.json({ submitted: 0, message: "Queue is empty" });

  const ids = rows.map((row: any) => row.id);
  await admin.from("seo_index_queue").update({ status: "processing" }).in("id", ids);
  const urlList = [...new Set(rows.map((row: any) => `${SITE_URL}${row.path === "/" ? "" : row.path}`))];

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: KEY_LOCATION, urlList }),
    });

    if (!response.ok && response.status !== 202) {
      const body = await response.text();
      await admin
        .from("seo_index_queue")
        .update({ status: "failed", last_error: `IndexNow ${response.status}: ${body.slice(0, 500)}` })
        .in("id", ids);
      return Response.json({ error: "IndexNow submission failed", status: response.status }, { status: 502 });
    }

    for (const row of rows) {
      await admin
        .from("seo_index_queue")
        .update({
          status: "submitted",
          processed_at: new Date().toISOString(),
          attempts: Number(row.attempts || 0) + 1,
          last_error: null,
        })
        .eq("id", row.id);
    }

    return Response.json({ submitted: urlList.length, status: response.status, urls: urlList });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const row of rows) {
      await admin
        .from("seo_index_queue")
        .update({ status: "failed", attempts: Number(row.attempts || 0) + 1, last_error: message })
        .eq("id", row.id);
    }
    return Response.json({ error: message }, { status: 500 });
  }
});
