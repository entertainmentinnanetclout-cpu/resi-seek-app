const SITE_URL = "https://www.reskonnect.org";

const escapeXml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const absoluteUrl = (path = "/") => `${SITE_URL}${path === "/" ? "" : path}`;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase server environment variables are not configured");
  return { url, key };
}

async function rest(path) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Supabase sitemap query failed: ${response.status}`);
  return response.json();
}

function urlset(rows) {
  const urls = rows.map(({ loc, lastmod }) => {
    const modified = lastmod ? `<lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : "";
    return `<url><loc>${escapeXml(loc)}</loc>${modified}</url>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

function sitemapIndex() {
  const entries = ["pages", "residences", "properties", "opportunities"]
    .map((name) => `<sitemap><loc>${SITE_URL}/sitemaps/${name}.xml</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

async function rowsFor(type) {
  if (type === "pages") {
    const rows = await rest("seo_public_pages_v?select=path,updated_at&order=path.asc&limit=5000");
    return rows.map((row) => ({ loc: absoluteUrl(row.path), lastmod: row.updated_at }));
  }
  if (type === "residences") {
    const rows = await rest("residences?select=slug,updated_at&is_visible=eq.true&slug=not.is.null&order=updated_at.desc&limit=5000");
    return rows.filter((row) => row.slug).map((row) => ({ loc: absoluteUrl(`/find-my-res/${encodeURIComponent(row.slug)}`), lastmod: row.updated_at }));
  }
  if (type === "properties") {
    const rows = await rest("property_opportunities?select=slug,updated_at&is_published=eq.true&order=updated_at.desc&limit=5000");
    return rows.map((row) => ({ loc: absoluteUrl(`/properties/${encodeURIComponent(row.slug)}`), lastmod: row.updated_at }));
  }
  if (type === "opportunities") {
    const rows = await rest("public_opportunities?select=slug,updated_at&is_published=eq.true&order=updated_at.desc&limit=5000");
    return rows.map((row) => ({ loc: absoluteUrl(`/opportunity/${encodeURIComponent(row.slug)}`), lastmod: row.updated_at }));
  }
  return [];
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400");
  res.setHeader("X-Robots-Tag", "noindex");

  try {
    const type = typeof req.query?.type === "string" ? req.query.type : null;
    if (!type) return res.status(200).send(sitemapIndex());
    const rows = await rowsFor(type);
    return res.status(200).send(urlset(rows));
  } catch (error) {
    console.error("sitemap generation failed", error);
    return res.status(503).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
  }
}
