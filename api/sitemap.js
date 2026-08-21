const SITE_URL = "https://www.reskonnect.org";
const SUPABASE_URL = "https://mefjzkhobkltlbmhusdh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZmp6a2hvYmtsdGxibWh1c2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTE5ODYsImV4cCI6MjA3NTg4Nzk4Nn0.h9VlKqtA4QMidLh_FbIiNviZRzeLe4OsBs1omh3Jy6U";

const STATIC_ROUTES = [
  "/", "/get-started", "/living", "/living/student-accommodation", "/living/private-rentals", "/living/parents",
  "/student-accommodation", "/student-accommodation/pretoria-west", "/student-accommodation/near-tut",
  "/student-accommodation/near-tut-pretoria-west", "/student-accommodation/near-tshwane-south-tvet",
  "/student-accommodation/tvet", "/student-accommodation/university", "/student-accommodation/nsfas-accredited",
  "/private-rentals", "/private-rentals/pretoria-west", "/private-rentals/bachelor-rooms-pretoria",
  "/find", "/applications", "/applications/tvet", "/applications/university", "/applications/private-college",
  "/applications/checker", "/applications/application-readiness", "/applications/tvet-application-readiness",
  "/applications/university-application-readiness", "/applications/aps-checker", "/opportunities", "/opportunities/wil",
  "/opportunities/wil-placement-support", "/opportunities/internships", "/opportunities/seta", "/partners",
  "/partners/landlords", "/partners/institutions", "/bursaries", "/events", "/campus-news", "/roommates",
  "/properties", "/property-auctions", "/student-accommodation-for-sale", "/development-opportunities", "/ai",
  "/guides/how-to-find-safe-student-accommodation", "/guides/student-accommodation-pretoria-west",
  "/guides/tvet-application-checklist", "/guides/university-application-checklist",
  "/guides/what-documents-do-you-need-for-student-accommodation", "/nsfas-accredited-accommodation",
  "/south-africa-student-accommodation", "/student-accommodation-gauteng", "/student-accommodation-limpopo",
  "/student-accommodation-western-cape", "/student-accommodation-kwazulu-natal"
];

const esc = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[c]));
const urlTag = (path, lastmod) => `  <url>\n    <loc>${esc(`${SITE_URL}${path === "/" ? "" : path}`)}</loc>${lastmod ? `\n    <lastmod>${esc(new Date(lastmod).toISOString())}</lastmod>` : ""}\n  </url>`;

async function getRows(resource, query) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${resource}?${query}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const [pages, residences, properties, opportunities] = await Promise.all([
    getRows("seo_pages", "select=path,updated_at&indexable=eq.true&content_status=eq.published"),
    getRows("residences", "select=slug,updated_at&is_visible=eq.true&slug=not.is.null"),
    getRows("property_opportunities", "select=slug,updated_at&is_published=eq.true"),
    getRows("public_opportunities", "select=slug,updated_at&is_published=eq.true"),
  ]);

  const urls = new Map();
  STATIC_ROUTES.forEach((path) => urls.set(path, null));
  pages.forEach((row) => row.path && urls.set(row.path, row.updated_at));
  residences.forEach((row) => row.slug && urls.set(`/find-my-res/${row.slug}`, row.updated_at));
  properties.forEach((row) => row.slug && urls.set(`/properties/${row.slug}`, row.updated_at));
  opportunities.forEach((row) => row.slug && urls.set(`/opportunities/${row.slug}`, row.updated_at));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...urls.entries()].map(([path,lastmod]) => urlTag(path,lastmod)).join("\n")}\n</urlset>\n`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
