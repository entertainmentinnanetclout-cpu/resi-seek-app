import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`LINK ROUTING QA FAILED: ${message}`);
  process.exit(1);
};

const config = JSON.parse(read("vercel.json"));
const redirects = Array.isArray(config.redirects) ? config.redirects : [];
const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
const headers = Array.isArray(config.headers) ? config.headers : [];

const spaFallback = rewrites.find(
  (rule) => rule.source === "/(.*)" && rule.destination === "/index",
);
if (!spaFallback) fail("Vercel SPA deep-link fallback /(.*) -> /index is missing.");

if (config.cleanUrls === true) {
  const badStaticTarget = rewrites.find(
    (rule) => typeof rule.destination === "string" && !rule.destination.startsWith("/api/") && /\.html(?:$|\?)/i.test(rule.destination),
  );
  if (badStaticTarget) {
    fail(`cleanUrls is enabled but rewrite ${badStaticTarget.source} targets ${badStaticTarget.destination}; use the extensionless clean URL instead.`);
  }
}

for (const source of ["/applications", "/living", "/opportunities", "/bursaries"]) {
  const rule = rewrites.find((candidate) => candidate.source === source);
  if (!rule || !String(rule.destination || "").startsWith("/_seo/") || String(rule.destination).endsWith(".html")) {
    fail(`${source} must target its extensionless prerender output when cleanUrls is enabled.`);
  }
}

const canonicalOrigin = "https://www.reskonnect.org";
for (const host of ["reskonnect.org", "reskonnect.co.za", "www.reskonnect.co.za"]) {
  const rule = redirects.find(
    (candidate) =>
      candidate.source === "/:path*" &&
      candidate.destination === `${canonicalOrigin}/:path*` &&
      candidate.has?.some(
        (condition) => condition.type === "header" && condition.key === "host" && condition.value === host,
      ),
  );
  if (!rule) fail(`Canonical host redirect is missing for ${host}.`);
}

const vercelAliasRedirect = redirects.find(
  (candidate) =>
    candidate.source === "/:path*" &&
    candidate.destination === `${canonicalOrigin}/:path*` &&
    candidate.has?.some(
      (condition) =>
        condition.type === "header" &&
        condition.key === "host" &&
        typeof condition.value === "object" &&
        condition.value?.suf === ".vercel.app",
    ),
);
if (!vercelAliasRedirect) fail("*.vercel.app canonical redirect is missing.");

const legacyFindRedirect = redirects.find(
  (rule) => rule.source === "/find-my-res" && rule.destination === "/find",
);
if (!legacyFindRedirect) fail("Legacy /find-my-res redirect is missing.");

for (const serviceWorkerPath of ["/sw.js", "/registerSW.js"]) {
  const rule = headers.find((candidate) => candidate.source === serviceWorkerPath);
  const cacheControl = rule?.headers?.find((header) => header.key.toLowerCase() === "cache-control")?.value;
  if (!cacheControl?.includes("must-revalidate")) {
    fail(`${serviceWorkerPath} must revalidate so stale installed apps recover promptly.`);
  }
}

const main = read("src/main.tsx");
if (!main.includes('const CANONICAL_ORIGIN = "https://www.reskonnect.org"')) {
  fail("Browser canonical-host recovery guard is missing from src/main.tsx.");
}
if (!main.includes('currentHost.endsWith(".vercel.app")')) {
  fail("Browser fallback does not recover Vercel alias hosts.");
}

const vite = read("vite.config.ts");
if (!vite.includes('request.mode === "navigate"') || !vite.includes('handler: "NetworkFirst"')) {
  fail("PWA navigation must remain NetworkFirst across mobile and installed-app clients.");
}
if (!vite.includes("cleanupOutdatedCaches: true") || !vite.includes("skipWaiting: true") || !vite.includes("clientsClaim: true")) {
  fail("PWA update takeover settings are incomplete.");
}
if (/urlPattern:\s*\/\\\.\(js\|css\|html\|/m.test(vite)) {
  fail("HTML must never return to the long-lived CacheFirst static asset cache.");
}

const share = read("src/lib/share.ts");
if (!share.includes("PUBLIC_SITE_ORIGIN")) fail("Universal share links are not pinned to the canonical public origin.");

console.log("Link routing QA passed: clean URL rewrites, canonical hosts, SPA deep links, PWA recovery and share origin are protected.");
