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
    if (!YOCO_SECRET) throw new Error("YOCO_SECRET_KEY not configured");

    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY")!;
    const userClient = createClient(EXTERNAL_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Invalid authentication");

    const { order_id } = await req.json();
    if (!order_id) throw new Error("Missing order_id");

    // Fetch order with yoco_checkout_id
    const { data: order, error: orderError } = await supabase
      .from("shop_orders")
      .select("*")
      .eq("id", order_id)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) throw new Error("Order not found or access denied");
    if (!order.yoco_checkout_id) throw new Error("No Yoco checkout associated with this order");

    // Already confirmed? Skip API call
    if (order.payment_status === "paid" || order.status === "confirmed") {
      return new Response(
        JSON.stringify({ verified: true, status: "already_confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Yoco API for checkout status
    const yocoRes = await fetch(
      `https://payments.yoco.com/api/checkouts/${order.yoco_checkout_id}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${YOCO_SECRET}` },
      }
    );

    const yocoData = await yocoRes.json();

    if (!yocoRes.ok) {
      console.error("Yoco API error:", yocoData);
      throw new Error("Failed to verify payment with Yoco");
    }

    if (yocoData.status === "completed") {
      // Payment confirmed — update order
      await supabase
        .from("shop_orders")
        .update({
          status: "confirmed",
          payment_status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      // Insert payment record
      await supabase.from("payments").insert({
        order_id: order_id,
        amount: Number(order.total_amount),
        payment_method: "card",
        payment_gateway: "yoco",
        payment_status: "completed",
        transaction_reference: order.yoco_checkout_id,
      });

      // Insert status history
      await supabase.from("order_status_history").insert({
        order_id: order_id,
        status: "confirmed",
        note: "Payment confirmed via Yoco card payment",
      });

      // Log webhook event for audit
      await supabase.from("webhook_events").insert({
        provider: "yoco",
        event_type: "payment.verified",
        payload: yocoData,
        processed: true,
      });

      return new Response(
        JSON.stringify({ verified: true, status: "confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Payment not yet completed
    return new Response(
      JSON.stringify({ verified: false, status: yocoData.status || "pending" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("yoco-verify-payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
