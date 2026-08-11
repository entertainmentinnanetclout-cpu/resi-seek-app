// OG image generator — returns a 1200x630 SVG card for any shareable entity
// Public, no auth required (social crawlers fetch it directly)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "https://mefjzkhobkltlbmhusdh.supabase.co";
const SUPABASE_ANON = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function fetchEntity(type: string, id: string): Promise<any> {
  const tableMap: Record<string, { table: string; cols: string }> = {
    product: { table: "products", cols: "name,description,price,images" },
    hamper: { table: "hampers", cols: "name,description,price,image_url" },
    deal: { table: "student_discounts", cols: "name,description,provider,discount,image_url" },
    residence: { table: "residences", cols: "name,campus,images" },
    bursary: { table: "bursaries", cols: "name,provider,amount,image_url" },
  };
  const cfg = tableMap[type];
  if (!cfg) return null;

  const url = `${SUPABASE_URL}/rest/v1/${cfg.table}?id=eq.${encodeURIComponent(id)}&select=${cfg.cols}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0] || null;
}

function buildSvg({
  title,
  subtitle,
  price,
  imageUrl,
  badge,
}: {
  title: string;
  subtitle: string;
  price?: string;
  imageUrl?: string;
  badge?: string;
}): string {
  const safeTitle = escapeXml(truncate(title, 70));
  const safeSubtitle = escapeXml(truncate(subtitle, 90));
  const safePrice = price ? escapeXml(price) : "";
  const safeBadge = badge ? escapeXml(badge) : "";

  // background gradient + brand stripe
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </linearGradient>
    <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.45"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  ${imageUrl ? `<image href="${escapeXml(imageUrl)}" x="640" y="40" width="520" height="550" preserveAspectRatio="xMidYMid slice"/>` : ""}
  ${imageUrl ? `<rect x="640" y="40" width="520" height="550" fill="url(#overlay)"/>` : ""}

  <!-- ResKonnect brand pill -->
  <rect x="60" y="50" rx="20" ry="20" width="220" height="50" fill="#fff"/>
  <text x="170" y="83" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="22" font-weight="800" fill="#1e1b4b">ResKonnect</text>

  ${safeBadge ? `<rect x="60" y="120" rx="14" ry="14" width="${Math.min(safeBadge.length * 14 + 30, 320)}" height="38" fill="#facc15"/>
  <text x="76" y="146" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" fill="#1e1b4b">${safeBadge}</text>` : ""}

  <!-- Title -->
  <foreignObject x="60" y="200" width="540" height="220">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, system-ui, sans-serif; font-size: 56px; font-weight: 800; color:#fff; line-height:1.1;">
      ${safeTitle}
    </div>
  </foreignObject>

  <!-- Subtitle -->
  <foreignObject x="60" y="430" width="540" height="80">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, system-ui, sans-serif; font-size: 24px; color:#e0e7ff; line-height:1.3;">
      ${safeSubtitle}
    </div>
  </foreignObject>

  ${safePrice ? `<rect x="60" y="530" rx="14" ry="14" width="240" height="60" fill="#fff"/>
  <text x="180" y="572" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="800" fill="#1e1b4b">${safePrice}</text>` : ""}

  <text x="1140" y="600" text-anchor="end" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#c7d2fe">www.reskonnect.org</text>
</svg>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "product";
    const id = url.searchParams.get("id") || "";

    let title = "ResKonnect";
    let subtitle = "Shop. Save. Care.";
    let price: string | undefined;
    let imageUrl: string | undefined;
    let badge: string | undefined;

    if (id) {
      const entity = await fetchEntity(type, id);
      if (entity) {
        switch (type) {
          case "product":
            title = entity.name;
            subtitle = entity.description || "Available now on ResKonnect Marketplace";
            price = entity.price ? `R${Number(entity.price).toFixed(2)}` : undefined;
            imageUrl = entity.images?.[0];
            badge = "PRODUCT";
            break;
          case "hamper":
            title = entity.name;
            subtitle = entity.description || "Curated student hamper bundle";
            price = entity.price ? `R${Number(entity.price).toFixed(2)}` : undefined;
            imageUrl = entity.image_url;
            badge = "HAMPER";
            break;
          case "deal":
            title = entity.name;
            subtitle = `${entity.provider || ""} — ${entity.description || ""}`.trim();
            price = entity.discount;
            imageUrl = entity.image_url;
            badge = "STUDENT DEAL";
            break;
          case "residence":
            title = entity.name;
            subtitle = entity.campus || "Verified student residence";
            imageUrl = entity.images?.[0];
            badge = "RESIDENCE";
            break;
          case "bursary":
            title = entity.name;
            subtitle = `${entity.provider || ""} — ${entity.amount || ""}`.trim();
            imageUrl = entity.image_url;
            badge = "BURSARY";
            break;
        }
      }
    }

    const svg = buildSvg({ title, subtitle, price, imageUrl, badge });

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (err) {
    console.error("og-image error", err);
    const fallback = buildSvg({
      title: "ResKonnect",
      subtitle: "Student super-app — accommodation, marketplace, deals & more",
    });
    return new Response(fallback, {
      headers: { ...corsHeaders, "Content-Type": "image/svg+xml; charset=utf-8" },
      status: 200,
    });
  }
});
