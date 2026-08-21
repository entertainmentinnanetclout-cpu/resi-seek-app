import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const failures = [];
const pass = (message) => console.log(`✓ ${message}`);
const fail = (message) => { failures.push(message); console.error(`✗ ${message}`); };
const expect = (condition, message) => condition ? pass(message) : fail(message);

const robots = read("public/robots.txt");
const vercel = read("vercel.json");
const seo = read("src/components/SEO.tsx");
const config = read("src/lib/seo/seoConfig.ts");
const fallback = read("src/pages/NotFound.tsx");
const sitemap = read("api/sitemap.js");
const managed = read("src/pages/seo/ManagedSeoPage.tsx");

expect(robots.includes("Sitemap: https://www.reskonnect.org/sitemap.xml"), "robots.txt exposes the canonical sitemap");
expect(robots.includes("Disallow: /admin") && robots.includes("Disallow: /dashboard") && robots.includes("Disallow: /wil"), "private application routes are crawler-blocked");
expect(robots.includes("Disallow: /marketplace"), "paused Marketplace remains excluded from search");
expect(!robots.includes("Disallow: /student-accommodation"), "student-accommodation discovery is crawlable");
expect(!robots.includes("Disallow: /opportunities/"), "public opportunity discovery is crawlable");

expect(vercel.includes('"/sitemap.xml"') && vercel.includes('"/api/sitemap"'), "Vercel routes the sitemap index to the dynamic generator");
for (const type of ["pages", "residences", "properties", "opportunities"]) {
  expect(vercel.includes(`/sitemaps/${type}.xml`) && sitemap.includes(`type === \"${type}\"`), `${type} child sitemap is configured`);
}

expect(fs.existsSync("public/9b698dd216df7a00d2f9a598a4372726.txt"), "IndexNow verification file exists");
expect(read("public/9b698dd216df7a00d2f9a598a4372726.txt").trim() === "9b698dd216df7a00d2f9a598a4372726", "IndexNow verification key is exact");

expect(config.includes('https://www.reskonnect.org'), "canonical domain is www.reskonnect.org");
expect(seo.includes('rel="canonical"') && seo.includes('name="robots"') && seo.includes('application/ld+json'), "global SEO component emits canonical, robots and JSON-LD");
expect(seo.includes("organizationSchema()") && seo.includes("webSiteSchema()"), "homepage emits canonical Organization and WebSite entities");
expect(managed.includes('data-ai-answer="true"'), "managed search pages expose direct AI-readable answer content");

const managedPaths = [
  "/ai",
  "/properties",
  "/property-auctions",
  "/student-accommodation-for-sale",
  "/development-opportunities",
  "/student-accommodation/pretoria",
  "/opportunities/internships",
  "/opportunities/seta",
];
for (const path of managedPaths) expect(fallback.includes(`\"${path}\"`), `managed search gateway contains ${path}`);
expect(fallback.includes("/^\\/properties\\/[^/]+$/"), "published property detail URLs are routed through the search gateway");

const forbiddenNoIndex = ["/student-accommodation", "/opportunities", "/properties", "/applications"];
for (const path of forbiddenNoIndex) {
  const exactLiteral = `\"${path}\",`;
  const noindexSection = config.match(/NOINDEX_PREFIXES[\s\S]*?\];/)?.[0] || "";
  expect(!noindexSection.includes(exactLiteral), `${path} is not accidentally in the noindex prefix list`);
}

if (failures.length) {
  console.error(`\nSEO QA failed with ${failures.length} issue(s).`);
  process.exit(1);
}
console.log("\nGolden Search SEO QA passed.");
