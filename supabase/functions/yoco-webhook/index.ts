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
    const EXTERNAL_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const EXTERNAL_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    const payload = await req.json();
    const eventType = payload.type || "unknown";

    // Log the webhook event
    await supabase.from("webhook_events").insert({
      provider: "yoco",
      event_type: eventType,
      payload,
      processed: false,
    });

    if (eventType === "payment.succeeded") {
      const metadata = payload.payload?.metadata || payload.metadata || {};
      const orderId = metadata.order_id;

      if (orderId) {
        // Update order status
        await supabase
          .from("shop_orders")
          .update({
            status: "confirmed",
            payment_status: "paid",
            payment_method: "yoco",
          })
          .eq("id", orderId);

        // Insert payment record
        await supabase.from("payments").insert({
          order_id: orderId,
          payment_method: "yoco",
          payment_gateway: "yoco",
          payment_status: "paid",
          amount: (payload.payload?.amount || payload.amount || 0) / 100,
          transaction_reference: payload.payload?.paymentId || payload.id || null,
        });

        // Insert status history
        await supabase.from("order_status_history").insert({
          order_id: orderId,
          status: "confirmed",
          note: "Payment confirmed via Yoco",
        });

        // Capture referral sale
        await supabase.rpc("capture_referral_sale", { _order_id: orderId });

        // Mark webhook as processed
        await supabase
          .from("webhook_events")
          .update({ processed: true })
          .eq("payload->>id", payload.id);
      }
    } else if (eventType === "payment.failed") {
      const metadata = payload.payload?.metadata || payload.metadata || {};
      const orderId = metadata.order_id;

      if (orderId) {
        await supabase
          .from("shop_orders")
          .update({ payment_status: "failed" })
          .eq("id", orderId);

        await supabase.from("order_status_history").insert({
          order_id: orderId,
          status: "payment_failed",
          note: "Payment failed via Yoco",
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("yoco-webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
