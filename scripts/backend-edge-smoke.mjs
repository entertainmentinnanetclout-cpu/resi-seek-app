#!/usr/bin/env node
/** Safe public GET-only Edge smoke: no accounts, application IDs or writes. */
const base = "https://mefjzkhobkltlbmhusdh.supabase.co";
const url = base + "/functions/v1/og-image?type=residence";
const response = await fetch(url, {
  method: "GET",
  headers: { Accept: "image/svg+xml" },
  signal: AbortSignal.timeout(12000),
  redirect: "error",
});
const body = await response.text();
const contentType = response.headers.get("content-type") || "";
if (!response.ok || !contentType.includes("image/svg+xml") || !body.includes("<svg") || !body.includes("ResKonnect")) {
  console.error("Public OG edge smoke failed: HTTP " + response.status + ", content-type " + contentType);
  process.exitCode = 1;
} else {
  console.log("PASS public OG Edge: HTTP " + response.status + ", SVG content and brand verified");
}
