import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const VERSION = "v2.0.0-external";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log(`[${VERSION}] resbot-ai request`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use EXTERNAL Supabase credentials
    const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const supabaseKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error(`[${VERSION}] Missing external Supabase credentials`);
      throw new Error("External database not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user profile for personalization
    let userContext = "";
    let applicationContext = "";
    let residenceContext = "";

    if (userId) {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, campus, course, year_of_study")
        .eq("id", userId)
        .single();

      if (profile) {
        userContext = `
User Profile:
- Name: ${profile.full_name || "Not provided"}
- Campus: ${profile.campus || "Not specified"}
- Course: ${profile.course || "Not specified"}
- Year of Study: ${profile.year_of_study || "Not specified"}
`;
      }

      // Get user's applications
      const { data: applications } = await supabase
        .from("applications")
        .select(`
          status,
          created_at,
          residences:residence_id (name, campus, price)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (applications && applications.length > 0) {
        applicationContext = `
User's Recent Applications:
${applications.map((app: any) => `- ${app.residences?.name || "Unknown"}: ${app.status} (Applied: ${new Date(app.created_at).toLocaleDateString()})`).join("\n")}
`;
      }
    }

    // Fetch some relevant residences
    const { data: residences } = await supabase
      .from("residences")
      .select("name, campus, price, room_type, available_spots, amenities")
      .gt("available_spots", 0)
      .order("created_at", { ascending: false })
      .limit(10);

    if (residences && residences.length > 0) {
      residenceContext = `
Available Residences (sample):
${residences.map((r: any) => `- ${r.name} (${r.campus || "Various"}): R${r.price}/month, ${r.room_type || "Various rooms"}, ${r.available_spots} spots, Amenities: ${r.amenities?.slice(0, 3).join(", ") || "Various"}`).join("\n")}
`;
    }

    const systemPrompt = `You are ResBot, an intelligent and friendly AI assistant for ResKonnect - South Africa's premier student accommodation platform for TUT (Tshwane University of Technology) students.

Your personality:
- Warm, helpful, and professional
- Use South African expressions occasionally (Howzit, Sharp, Eish, Lekker)
- Emoji-friendly but not excessive
- Concise but thorough answers

Your knowledge includes:
- Student accommodation across all TUT campuses (Soshanguve, Ga-Rankuwa, Pretoria, Mbombela, Polokwane, eMalahleni)
- NSFAS funding (R45,000-R70,000/year for accommodation)
- Price ranges (R2,000-R8,000/month)
- Room types: Single, Sharing, Bachelor, Commune
- Common amenities: WiFi, Security, Laundry, Gym, Meals, Study rooms
- Application process on ResKonnect
- Document requirements (ID, Proof of Registration, NSFAS letter)

${userContext}
${applicationContext}
${residenceContext}

Guidelines:
1. If user asks about specific residences, use the data provided above
2. If user asks about their applications, reference their application status
3. Personalize responses based on user's campus when known
4. Always encourage users to use ResKonnect's features (filters, compare tool, favorites)
5. For complex issues, suggest contacting support via WhatsApp
6. Keep responses under 200 words unless detailed info is requested
7. Use markdown formatting for better readability (bold, lists, etc.)
8. Be accurate - don't make up residence names or prices not in the data`;

    console.log(`[${VERSION}] Calling AI with message:`, message.substring(0, 100));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Rate limit exceeded", 
            fallback: "I'm a bit busy right now! 😅 Please try again in a moment, or use our quick filters to find residences." 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Payment required",
            fallback: "I'm taking a short break! 🌟 Meanwhile, browse our residences or check your application status in the dashboard."
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "I'm having trouble understanding. Could you rephrase that?";

    console.log(`[${VERSION}] AI response received`);

    return new Response(
      JSON.stringify({ response: aiResponse, _version: VERSION }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${VERSION}] ResBot AI error:`, error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        fallback: "Oops! Something went wrong. 😕 Try asking about residences, NSFAS, or how to apply!",
        _version: VERSION
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
