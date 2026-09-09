import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const checks = [];
const expect = (ok, message) => checks.push({ ok: Boolean(ok), message });

const app = read("src/App.tsx");
const api = read("src/lib/virtualTours/api.ts");
const viewer = read("src/pages/VirtualTourViewerPage.tsx");
const panorama = read("src/components/virtualTours/VirtualTourPanorama.tsx");
const card = read("src/components/findmyres/ResidenceBrandStudioCard.tsx");
const portal = read("src/pages/residence/ResidenceVirtualTour.tsx");
const toolEngine = read("supabase/functions/dimpho-tool-engine/index.ts");
const migration = read("supabase/migrations/20260909133500_reskonnect_360_studio_v2_rg3_rg4.sql");

expect(app.includes('path="/tour/:token"'), "Public /tour/:token route is registered");
expect(!api.includes('functions.invoke("virtual-tour-api"') && !api.includes("functions/v1/virtual-tour-api"), "Frontend does not depend on retired virtual-tour-api Edge Function");
expect(api.includes('analytics_summary') && api.includes('request_upgrade'), "Premium/Gold runtime exposes analytics and upgrade actions");
expect(api.includes('publicTourForResidence'), "Marketplace virtual-tour discovery helper exists");
expect(card.includes("VirtualTourMarketBadge"), "Find My Res branded cards expose Gold 360 discovery");
expect(portal.includes("VirtualTourGoldAnalytics"), "Property OS exposes Gold analytics/upgrade UX");
expect(viewer.includes("motion_enabled") && viewer.includes("scene_dwell") && viewer.includes("apply_click"), "Gold viewer records motion, dwell and conversion events");
expect(panorama.includes("DeviceOrientationCamera") && panorama.includes("deviceMemory"), "Viewer contains mobile motion and low-memory optimization");
expect(toolEngine.includes('get_virtual_tour') && toolEngine.includes('get_virtual_tour_scene'), "Dimpho tool runtime understands published 360 tours and scenes");
expect(migration.includes("virtual_tour_marketplace_index") && migration.includes("virtual_tour_enforce_scene_entitlement"), "RG3/RG4 migration contains safe marketplace index and server-side quota enforcement");
expect(migration.includes("virtual_tour_rg3") && migration.includes("virtual_tour_rg4"), "RG3/RG4 release state is source-controlled");
expect(!fs.existsSync("supabase/functions/virtual-tour-api/index.ts"), "Retired virtual-tour-api source remains removed");

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "✓" : "✗"} ${item.message}`);
if (failed.length) {
  console.error(`\n360 Studio QA failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\n360 Studio RG3/RG4 QA passed: ${checks.length}/${checks.length} release protections verified.`);
