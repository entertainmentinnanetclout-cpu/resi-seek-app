#!/usr/bin/env node
/**
 * Low-volume, external, read-only liveness checks for ResKonnect.
 * Scheduled by GitHub Actions, NOT by pg_cron, so a database outage
 * cannot stop the monitor from detecting that outage.
 *
 * This does NOT authenticate a user or verify Google OAuth completion.
 * No personal data or non-public tokens are ever logged.
 */
import { readFileSync } from "node:fs";

const PROJECT = "mefjzkhobkltlbmhusdh";
const ORIGIN = "https://www.reskonnect.org";
const SUPABASE = "https://" + PROJECT + ".supabase.co";

function readPublicKey() {
  if (process.env.RESKONNECT_SUPABASE_PUBLIC_KEY) return process.env.RESKONNECT_SUPABASE_PUBLIC_KEY;
  const source = readFileSync("src/integrations/supabase/client.ts", "utf8");
  // This is the existing public browser anon key, never a service-role key.
  const match = source.match(/export const EXTERNAL_SUPABASE_ANON_KEY\s*=\s*["']([^"']+)["']/);
  if (!match || !match[1]) throw new Error(
    "Public anon key not found. Set RESKONNECT_SUPABASE_PUBLIC_KEY in the workflow environment."
  );
  return match[1];
}

const publicKey = readPublicKey();
const checks = [
  { name: "Vercel production site", url: ORIGIN + "/", headers: { Accept: "text/html" }, check: () => true },
  { name: "Supabase Auth process", url: SUPABASE + "/auth/v1/health", headers: { apikey: publicKey }, check: (body) => {
    try { return typeof JSON.parse(body).name === "string"; } catch { return false; }
  } },
  { name: "PostgREST database access", url: SUPABASE + "/rest/v1/reskonnect_city_coverage_v?select=city_key&limit=1",
    headers: { apikey: publicKey, Authorization: "Bearer " + publicKey, Accept: "application/json" },
    check: (body) => {
      try { return Array.isArray(JSON.parse(body)); } catch { return false; }
    } },
];

async function probe(check) {
  const signal = AbortSignal.timeout(10_000);
  const response = await fetch(check.url, {
    method: "GET", headers: check.headers, signal, cache: "no-store", redirect: "follow",
  });
  const text = await response.text();
  if (!response.ok || !check.check(text)) {
    throw new Error("HTTP " + response.status + " or unexpected health response");
  }
  return response.status;
}

let failures = 0;
for (const check of checks) {
  let passed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const code = await probe(check);
      console.log("PASS " + check.name + " (HTTP " + code + ")");
      passed = true;
      break;
    } catch (error) {
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 2000));
      else console.error("FAIL " + check.name + ": " + (error instanceof Error ? error.message : "request error"));
    }
  }
  if (!passed) failures++;
}
if (failures) {
  console.error(failures + " infrastructure health check(s) failed. Check Supabase status, Auth and database logs.");
  process.exitCode = 1;
} else {
  console.log("All three non-mutating infrastructure liveness checks passed. User login is NOT certified by these probes.");
}
