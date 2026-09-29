import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const origin = "http://127.0.0.1:8092";
const server = await createServer({ server: { host: "127.0.0.1", port: 8092 } });
await server.listen();

const residence = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Fixture Residence",
  address: "Pretoria",
  campus: "Pretoria West (Main Campus)",
  price: 3500,
  private_price: 3500,
  available_spots: 5,
  is_visible: true,
  latitude: -25.754,
  longitude: 28.188,
  room_type: "single",
  image_url: null,
};

const routes = ["/", "/find", "/opportunities", "/ai", "/partners", "/install", "/about"];
const failures = [];
fs.mkdirSync("artifacts", { recursive: true });

const profiles = [
  { name: "chromium-desktop", engine: chromium, viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: "chromium-tablet", engine: chromium, viewport: { width: 820, height: 1180 }, isMobile: true },
  { name: "webkit-iphone", engine: webkit, viewport: { width: 390, height: 844 }, isMobile: true },
  { name: "webkit-ipad", engine: webkit, viewport: { width: 1024, height: 1366 }, isMobile: true },
  { name: "webkit-mac", engine: webkit, viewport: { width: 1512, height: 982 }, isMobile: false },
];

async function fulfillSupabase(route) {
  const url = new URL(route.request().url());
  const path = url.pathname;
  let body = {};

  if (path.includes("/auth/v1/user")) {
    body = { user: null };
  } else if (path.includes("/auth/v1/token")) {
    body = { session: null, user: null };
  } else if (path.includes("/rest/v1/rpc/get_my_access_context")) {
    body = {};
  } else if (path.includes("/rest/v1/rpc/reskonnect_opportunity_feed")) {
    body = { items: [{ id: "opp-public-1", title: "Fixture Opportunity", organisation: "ResKonnect", to_path: "/opportunities", match_reason: "Public fixture" }] };
  } else if (path.includes("/rest/v1/rpc/virtual_tour_public_snapshot")) {
    body = {
      tour: { id: "30000000-0000-4000-8000-000000000001", title: "Fixture 360", workspace_type: "standalone" },
      workspace: { type: "standalone", label: "Fixture 360" },
      residence: null,
      scenes: [],
      hotspots: [],
      connections: [],
    };
  } else if (path.includes("/rest/v1/residences")) {
    body = [residence];
  } else if (path.includes("/rest/v1/residence_room_types")) {
    body = [];
  } else if (path.includes("/rest/v1/resmap_campuses")) {
    body = [{ id: "c1", campus_key: "pretoria-west", name: "Pretoria West (Main Campus)", latitude: -25.754, longitude: 28.188, is_active: true }];
  } else if (path.includes("/rest/v1/resmap_map_config")) {
    body = { google_maps_enabled: false, raster_primary_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", raster_fallback_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" };
  } else if (path.includes("/rest/v1/")) {
    body = path.includes("/rpc/") ? {} : [];
  }

  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockNetwork(context) {
  await context.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());

    if (url.origin === origin) return route.continue();
    if (url.hostname.endsWith(".supabase.co")) return fulfillSupabase(route);

    if (
      url.hostname.includes("tile.openstreetmap.org") ||
      url.hostname.includes("openstreetmap.fr") ||
      ["image", "font", "media"].includes(req.resourceType())
    ) {
      return route.fulfill({ status: 204, body: "" });
    }

    // Public smoke is deliberately isolated from third-party analytics/CDNs.
    // Block them without turning optional remote integrations into test failures.
    return route.abort("blockedbyclient");
  });
}

try {
  for (const profile of profiles) {
    const browser = await profile.engine.launch({ headless: true });
    try {
      const context = await browser.newContext({
        viewport: profile.viewport,
        isMobile: profile.isMobile,
        serviceWorkers: "block",
        locale: "en-ZA",
      });
      await mockNetwork(context);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));

      for (const routePath of routes) {
        try {
          errors.length = 0;
          await page.goto(origin + routePath, { waitUntil: "domcontentloaded", timeout: 30_000 });
          await page.waitForTimeout(700);

          assert.equal(
            await page.getByText("Something went wrong", { exact: true }).count(),
            0,
            `${profile.name} ${routePath}: error boundary rendered`,
          );
          assert.deepEqual(errors, [], `${profile.name} ${routePath}: ${errors.join("; ")}`);

          const overflow = await page.evaluate(() => ({
            viewport: document.documentElement.clientWidth,
            html: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
            path: location.pathname,
          }));
          assert.ok(overflow.html <= overflow.viewport + 4, `${profile.name} ${routePath}: html horizontal overflow ${JSON.stringify(overflow)}`);
          assert.ok(overflow.body <= overflow.viewport + 4, `${profile.name} ${routePath}: body horizontal overflow ${JSON.stringify(overflow)}`);
          console.log("PASS", profile.name, routePath);
        } catch (error) {
          const message = error instanceof Error ? error.stack || error.message : String(error);
          failures.push({ profile: profile.name, route: routePath, message, pageErrors: [...errors], url: page.url() });
          console.error("FAIL", profile.name, routePath, message);
        }
      }

      await page.goto(origin + "/install", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Install ResKonnect" }).waitFor({ timeout: 10_000 });
      await context.close();
    } finally {
      await browser.close();
    }
  }

  fs.writeFileSync("artifacts/web-platform-smoke.json", JSON.stringify({ failures }, null, 2));
  if (failures.length) {
    throw new Error(`Cross-browser public smoke failed with ${failures.length} failure(s). See artifacts/web-platform-smoke.json.`);
  }
  console.log(`Cross-browser responsive public smoke passed (${profiles.length} profiles × ${routes.length} routes).`);
} finally {
  if (!fs.existsSync("artifacts/web-platform-smoke.json")) {
    fs.writeFileSync("artifacts/web-platform-smoke.json", JSON.stringify({ failures }, null, 2));
  }
  await server.close();
}
