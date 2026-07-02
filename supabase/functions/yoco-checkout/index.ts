import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YOCO_SECRET = Deno.env.get("YOCO_SECRET_KEY");
    if (!YOCO_SECRET) {
      throw new Error("YOCO_SECRET_KEY not configured");
    }

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    // Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(EXTERNAL_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Invalid authentication");

    const { order_id, success_url, cancel_url } = await req.json();

    if (!order_id || !success_url || !cancel_url) {
      throw new Error("Missing required fields: order_id, success_url, cancel_url");
    }

    // Fetch the order and verify ownership
    const { data: order, error: orderError } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) throw new Error("Order not found or access denied");

    // Create Yoco checkout session
    const amountInCents = Math.round(Number(order.total_amount) * 100);

    const yocoRes = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${YOCO_SECRET}`,
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: "ZAR",
        successUrl: `${success_url}?order_id=${order_id}&payment=success`,
        cancelUrl: `${cancel_url}?payment=cancelled`,
        metadata: {
          order_id: order_id,
          order_number: order.order_number,
          user_id: user.id,
        },
      }),
    });

    const yocoBody = await yocoRes.json();

    if (!yocoRes.ok) {
      console.error("Yoco API error:", yocoBody);
      throw new Error(yocoBody?.displayMessage || "Failed to create Yoco checkout");
    }

    // Update order with Yoco checkout ID and payment info
    await supabase
      .from("shop_orders")
      .update({
        payment_method: "yoco",
        payment_status: "awaiting_payment",
        yoco_checkout_id: yocoBody.id,
      })
      .eq("id", order_id);

    return new Response(
      JSON.stringify({ redirectUrl: yocoBody.redirectUrl, checkoutId: yocoBody.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("yoco-checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
