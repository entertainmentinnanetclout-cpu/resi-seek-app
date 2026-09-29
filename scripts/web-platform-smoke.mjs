import { chromium, webkit } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "vite";

const origin = "http://127.0.0.1:8092";
const server = await createServer({ server: { host: "127.0.0.1", port: 8092 } });
await server.listen();

const routes = ["/", "/find", "/opportunities", "/ai", "/partners", "/install", "/about"];
const profiles = [
  { name: "chromium-desktop", engine: chromium, viewport: { width: 1440, height: 900 }, isMobile: false },
  { name: "chromium-tablet", engine: chromium, viewport: { width: 820, height: 1180 }, isMobile: true },
  { name: "webkit-iphone", engine: webkit, viewport: { width: 390, height: 844 }, isMobile: true },
  { name: "webkit-ipad", engine: webkit, viewport: { width: 1024, height: 1366 }, isMobile: true },
  { name: "webkit-mac", engine: webkit, viewport: { width: 1512, height: 982 }, isMobile: false },
];

async function mockNetwork(context) {
  await context.route("**/*", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin) return route.continue();

    if (url.hostname.endsWith(".supabase.co")) {
      if (url.pathname.includes("/auth/v1/")) {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user: null, session: null }) });
      }
      if (url.pathname.includes("/rest/v1/")) {
        const body = url.pathname.includes("/rpc/") ? {} : [];
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }

    if (["image", "font", "media"].includes(req.resourceType())) {
      return route.fulfill({ status: 204, body: "" });
    }
    return route.abort();
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

      for (const route of routes) {
        errors.length = 0;
        await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForTimeout(450);
        assert.equal(await page.getByText("Something went wrong", { exact: true }).count(), 0, `${profile.name} ${route}: error boundary rendered`);
        assert.deepEqual(errors, [], `${profile.name} ${route}: ${errors.join("; ")}`);

        const overflow = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
        }));
        assert.ok(overflow.scroll <= overflow.viewport + 2, `${profile.name} ${route}: document horizontal overflow ${JSON.stringify(overflow)}`);
        assert.ok(overflow.body <= overflow.viewport + 2, `${profile.name} ${route}: body horizontal overflow ${JSON.stringify(overflow)}`);
        console.log("PASS", profile.name, route);
      }

      await page.goto(origin + "/install", { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Install ResKonnect" }).waitFor();
      await context.close();
    } finally {
      await browser.close();
    }
  }
  console.log(`Cross-browser responsive smoke passed (${profiles.length} profiles × ${routes.length} routes).`);
} finally {
  await server.close();
}
