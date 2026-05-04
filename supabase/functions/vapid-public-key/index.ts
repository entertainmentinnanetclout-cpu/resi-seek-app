const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  return new Response(JSON.stringify({ publicKey }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});