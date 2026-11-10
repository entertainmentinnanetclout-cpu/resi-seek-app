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


// A second independent public function needed by push registration.
// Read-only, no user accounts or push subscriptions created.
const keyResponse = await fetch(base + "/functions/v1/vapid-public-key", {
  method: "GET",
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(12000),
  redirect: "error",
});
let keyPayload = null;
try { keyPayload = await keyResponse.json(); } catch { /* strict check below */ }
if (!keyResponse.ok || !keyPayload || typeof keyPayload.publicKey !== "string") {
  console.error("Public VAPID key endpoint failed: HTTP " + keyResponse.status);
  process.exitCode = 1;
} else {
  console.log("PASS public push-key Edge: HTTP " + keyResponse.status);
  if (!keyPayload.publicKey) console.warn("WARN: Push public VAPID key is empty; push subscription setup may not be configured.");
}
