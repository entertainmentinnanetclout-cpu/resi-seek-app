import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://www.reskonnect.org";
const INDEXNOW_KEY = "9b698dd216df7a00d2f9a598a4372726";
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: queued, error: queueError } = await supabase
    .from("seo_index_queue")
    .select("id,path,action,engines,attempts")
    .eq("status", "pending")
    .contains("engines", ["bing_indexnow"])
    .lt("attempts", 5)
    .order("queued_at", { ascending: true })
    .limit(100);

  if (queueError) {
    return new Response(JSON.stringify({ error: queueError.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  if (!queued?.length) {
    return new Response(JSON.stringify({ processed: 0, message: "No pending IndexNow URLs" }), {
      headers: { "content-type": "application/json" },
    });
  }

  const ids = queued.map((item) => item.id);
  await supabase.from("seo_index_queue").update({ status: "processing" }).in("id", ids);

  const urlList = [...new Set(queued.map((item) => `${SITE_URL}${item.path === "/" ? "" : item.path}`))];

  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: "www.reskonnect.org",
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
  });

  if (response.ok || response.status === 202) {
    const { error: updateError } = await supabase
      .from("seo_index_queue")
      .update({ status: "submitted", processed_at: new Date().toISOString(), last_error: null })
      .in("id", ids);

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message, indexNowStatus: response.status }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ processed: ids.length, submittedUrls: urlList.length, indexNowStatus: response.status }), {
      headers: { "content-type": "application/json" },
    });
  }

  const errorText = (await response.text()).slice(0, 1000);
  for (const item of queued) {
    const attempts = (item.attempts ?? 0) + 1;
    await supabase
      .from("seo_index_queue")
      .update({
        attempts,
        status: attempts >= 5 ? "failed" : "pending",
        last_error: `IndexNow ${response.status}: ${errorText}`,
      })
      .eq("id", item.id);
  }

  return new Response(JSON.stringify({ error: "IndexNow submission failed", status: response.status, detail: errorText }), {
    status: 502,
    headers: { "content-type": "application/json" },
  });
});
