const SITE_URL = "https://www.reskonnect.org";

// Canonical public URLs only. Query-string UI states are deliberately excluded:
// Google may crawl them, but SEO.tsx canonicalises them to the clean pathname.
// Dynamic/large-scale programmatic URLs belong in seo_public_pages_v so the database
// quality gate controls whether they enter search discovery.
const STATIC_PAGE_PATHS = [
  "/",
  "/get-started",
  "/find",
  "/living",
  "/living/student-accommodation",
  "/living/private-rentals",
  "/living/parents",
  "/applications",
  "/applications/tvet",
  "/applications/university",
  "/applications/private-college",
  "/applications/checker",
  "/applications/application-readiness",
  "/applications/tvet-application-readiness",
  "/applications/university-application-readiness",
  "/applications/aps-checker",
  "/opportunities",
  "/opportunities/wil",
  "/opportunities/wil-placement-support",
  "/opportunities/internships",
  "/opportunities/seta",
  "/partners",
  "/partners/landlords",
  "/partners/institutions",
  "/bursaries",
  "/discounts",
  "/events",
  "/campus-news",
  "/roommates",
  "/affiliates",
  "/student-accommodation",
  "/student-accommodation/pretoria",
  "/student-accommodation/pretoria-west",
  "/student-accommodation/near-tut",
  "/student-accommodation/near-tut-pretoria-west",
  "/student-accommodation/near-tshwane-south-tvet",
  "/student-accommodation/tvet",
  "/student-accommodation/university",
  "/student-accommodation/nsfas-accredited",
  "/private-rentals",
  "/private-rentals/pretoria-west",
  "/private-rentals/bachelor-rooms-pretoria",
  "/properties",
  "/property-auctions",
  "/student-accommodation-for-sale",
  "/development-opportunities",
  "/ai",
  "/guides/how-to-find-safe-student-accommodation",
  "/guides/student-accommodation-pretoria-west",
  "/guides/tvet-application-checklist",
  "/guides/university-application-checklist",
  "/guides/what-documents-do-you-need-for-student-accommodation",
  "/terms",
  "/privacy",
];

const escapeXml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const normalizePath = (path = "/") => {
  if (!path || path === "/") return "/";
  return `/${String(path).replace(/^\/+|\/+$/g, "")}`;
};

const absoluteUrl = (path = "/") => {
  const normalized = normalizePath(path);
  return `${SITE_URL}${normalized === "/" ? "" : normalized}`;
};

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

function dedupeRows(rows) {
  const byLoc = new Map();
  for (const row of rows) {
    if (!row?.loc) continue;
    const existing = byLoc.get(row.loc);
    if (!existing || (!existing.lastmod && row.lastmod)) byLoc.set(row.loc, row);
  }
  return [...byLoc.values()].sort((a, b) => a.loc.localeCompare(b.loc));
}

function urlset(rows) {
  const urls = dedupeRows(rows).map(({ loc, lastmod }) => {
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
    const staticRows = STATIC_PAGE_PATHS.map((path) => ({ loc: absoluteUrl(path), lastmod: null }));
    const rows = await rest("seo_public_pages_v?select=path,updated_at&order=path.asc&limit=5000");
    const managedRows = rows.map((row) => ({ loc: absoluteUrl(row.path), lastmod: row.updated_at }));
    return dedupeRows([...staticRows, ...managedRows]);
  }
  if (type === "residences") {
    const rows = await rest("residences?select=slug,updated_at&is_visible=eq.true&slug=not.is.null&order=updated_at.desc&limit=5000");
    return rows.filter((row) => row.slug).map((row) => ({ loc: absoluteUrl(`/find-my-res/${encodeURIComponent(row.slug)}`), lastmod: row.updated_at }));
  }
  if (type === "properties") {
    const rows = await rest("property_opportunities?select=slug,updated_at&is_published=eq.true&slug=not.is.null&order=updated_at.desc&limit=5000");
    return rows.filter((row) => row.slug).map((row) => ({ loc: absoluteUrl(`/properties/${encodeURIComponent(row.slug)}`), lastmod: row.updated_at }));
  }
  if (type === "opportunities") {
    const rows = await rest("public_opportunities?select=slug,updated_at&is_published=eq.true&slug=not.is.null&order=updated_at.desc&limit=5000");
    return rows.filter((row) => row.slug).map((row) => ({ loc: absoluteUrl(`/opportunity/${encodeURIComponent(row.slug)}`), lastmod: row.updated_at }));
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
    if (!["pages", "residences", "properties", "opportunities"].includes(type)) {
      return res.status(404).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
    }
    const rows = await rowsFor(type);
    return res.status(200).send(urlset(rows));
  } catch (error) {
    console.error("sitemap generation failed", error);
    return res.status(503).send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
  }
}
