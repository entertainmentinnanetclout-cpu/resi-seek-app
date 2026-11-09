import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (name) => readFileSync(name, "utf8");
const routes = JSON.parse(read("vercel.json")).rewrites;
const app = read("src/App.tsx");
const landing = read("src/pages/Landing.tsx");
const privacy = read("src/pages/Privacy.tsx");
const seo = read("scripts/prerender-seo.mjs");

test("Google OAuth homepage and policy are public, canonical, and do not redirect to sign-in", () => {
  assert.equal(routes.find((r) => r.source === "/")?.destination, "/_seo/home");
  assert.equal(routes.find((r) => r.source === "/privacy")?.destination, "/_seo/privacy");
  assert.match(app, /path="\/privacy" element=\{<Privacy \/>\}/);
  assert.match(landing, /Privacy Policy & Google user data/);
  assert.match(landing, /What ResKonnect does|ResKonnect connects students with accommodation/);
  assert.match(privacy, /Connected Google Gmail accounts/);
  assert.match(privacy, /Last updated: 9 November 2026/);
});

test("server-delivered SEO HTML contains actual human-readable homepage and privacy content", () => {
  assert.ok(existsSync("dist/_seo/home.html"), "build must prerender homepage");
  assert.ok(existsSync("dist/_seo/privacy.html"), "build must prerender privacy policy");
  const home = read("dist/_seo/home.html");
  const policy = read("dist/_seo/privacy.html");
  assert.match(home, /What ResKonnect does/);
  assert.match(home, /Why ResKonnect requests Gmail permission/);
  assert.match(home, /<a href="\/privacy">Privacy Policy/);
  assert.match(home, /<a href="\/terms">Terms of Service/);
  assert.match(home, /Residence team services/);
  assert.match(home, /Gmail send-only permission/);
  assert.match(policy, /<h1[^>]*>Privacy Policy<\/h1>/);
  assert.match(policy, /https:\/\/www\.googleapis\.com\/auth\/gmail\.send/);
  assert.match(policy, /Google Gmail accounts/);
  assert.match(policy, /Access is limited to authorised functions/);
  assert.match(policy, /Disconnected|Disconnecting Gmail/i);
  assert.match(policy, /Google Account connections/);
  assert.match(policy, /reskonnect@gmail\.com/);
  assert.match(policy, /<a href="\/">ResKonnect Home<\/a>/);
  assert.match(policy, /https:\/\/www\.reskonnect\.org\/privacy/);
  assert.doesNotMatch(policy, /name="robots" content="noindex/i);
  assert.doesNotMatch(policy, /login is required to view/i);
  assert.ok(policy.length > 8000, "full privacy document must not be an empty app shell");
});

test("marketing pixels are not loaded before privacy consent", () => {
  const shell = read("index.html");
  const tracker = read("src/lib/metaPixel.ts");
  assert.ok(!shell.includes("connect.facebook.net/en_US/fbevents.js"));
  assert.ok(!shell.includes("facebook.com/tr?id="));
  assert.ok(!shell.includes("fbq('init'"));
  assert.ok(tracker.includes('getMarketingConsent() !== "granted"'));
});

test("Google reviewers and users receive consistent Gmail scope disclosures", () => {
  assert.match(privacy, /Gmail send-only/);
  assert.match(privacy, /does not allow ResKonnect to read your Gmail inbox/);
  assert.match(seo, /Google Gmail accounts/);
  assert.match(seo, /\bGmail send-only\b/);
  assert.match(seo, /gmail\.send/);
  assert.match(privacy, /removes the locally stored sending credential/);
});
