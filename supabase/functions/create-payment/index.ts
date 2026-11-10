import { serve } from "https://deno.land/std/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }

  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    const { amount, order_id } = await req.json()

    if (!amount || !order_id) {
      throw new Error("Missing amount or order_id")
    }

    // Convert to cents
    const amountInCents = Math.round(amount * 100)

    const YOCO_SECRET = Deno.env.get("YOCO_SECRET_KEY")

    if (!YOCO_SECRET) {
      throw new Error("Missing YOCO_SECRET_KEY")
    }

    const response = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${YOCO_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: "ZAR",
        metadata: {
          order_id,
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || "Yoco API error")
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("EDGE FUNCTION ERROR:", error.message)

    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})