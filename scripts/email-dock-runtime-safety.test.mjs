import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const edge = read("supabase/functions/reskonnect-email-dock/index.ts");
const inbox = read("src/components/communications/PremiumEmailDock.tsx");
const hero = read("src/components/HeroCarousel.tsx");
const landing = read("src/pages/Landing.tsx");
const motion = read("src/styles/premium-gold-depth.css");

test("email Edge Function has only one SHA-256 utility and one reviewed send hash", () => {
  assert.equal((edge.match(/^const sha256=/gm) || []).length, 1,
    "Duplicate SHA-256 declarations prevent the deployed Edge Function from booting");
  assert.match(edge, /const reviewedHash=/);
  assert.match(edge, /caseFingerprint/);
});

test("Email Dock responds to CORS preflight without requiring a login", () => {
  assert.match(edge, /req\.method==="OPTIONS"/);
  assert.match(edge, /Access-Control-Allow-Headers/);
  assert.match(edge, /Access-Control-Allow-Methods/);
  assert.match(edge, /req\.headers\.get\("authorization"\)/);
});

test("failed inbox queries explain the outage and expose a retry action", () => {
  assert.match(inbox, /queueError/);
  assert.match(inbox, /role="alert"/);
  assert.match(inbox, /Retry loading/);
  assert.match(inbox, /Case counts unavailable until the connection recovers/);
  assert.match(inbox, /loadedQueueKeyRef/);
});

test("gold interactive landing depth preserves a reduced-motion alternative", () => {
  assert.match(hero, /rk-gold-hero/);
  assert.match(landing, /GoldTiltCard/);
  assert.match(motion, /prefers-reduced-motion: reduce/);
  assert.match(motion, /@media \(max-width: 767px\)/);
});
