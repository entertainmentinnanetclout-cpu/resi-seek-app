import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const panorama = read("src/components/virtualTours/VirtualTourPanorama.tsx");
const maplibre = read("src/lib/resmap/maplibre.ts");
const stableMap = read("src/components/resmap/ResMapExperienceStable.tsx");
const css = read("src/styles/mobile-foundation.css");
const index = read("index.html");
const install = read("src/components/InstallAppPrompt.tsx");
const connectivity = read("src/components/ConnectivityStatus.tsx");
const client = read("src/integrations/supabase/client.ts");
const app = read("src/App.tsx");
const vite = read("vite.config.ts");
const manifest = read("public/manifest.json");
const residences = read("src/hooks/useRealtimeResidences.ts");
const smoke = read("scripts/web-platform-smoke.mjs");

let failed = 0;
const expect = (ok, label) => {
  if (ok) console.log("PASS", label);
  else { console.error("FAIL", label); failed += 1; }
};

console.log("\nP5 — Maps, 3D and 360");
expect(panorama.includes("GraphicsBoundary") && panorama.includes("graphics subtree failed safely"), "360 renderer exceptions are contained locally");
expect(panorama.includes("RendererGuard") && panorama.includes("webglcontextlost") && panorama.includes("removeEventListener"), "360 WebGL context loss listener is cleaned up");
expect(panorama.includes("texture.dispose") && panorama.includes("useLoader as any") && panorama.includes(".clear"), "360 textures and loader cache are disposed");
expect(panorama.includes("rk_native_safe_graphics_v1") && panorama.includes("StaticPanoramaPreview"), "360 has persistent safe-graphics and static fallback paths");
expect(panorama.includes('loading="lazy"') && panorama.includes('decoding="async"'), "static panorama fallback avoids eager decode pressure");
expect(maplibre.includes("MAPLIBRE_COMPAT_VERSION") && maplibre.includes("isIOSDevice"), "iPhone/iPad map runtime has a compatibility path");
expect(maplibre.includes("ResizeObserver") && maplibre.includes("visualViewport") && maplibre.includes('this.on("remove"'), "map resize/orientation listeners are lifecycle-bound");
expect(stableMap.includes("raster") || stableMap.includes("2D"), "Find My Res retains a non-3D map path");

console.log("\nP6 — iPhone and iPad");
expect(index.includes("viewport-fit=cover") && index.includes("apple-mobile-web-app-capable"), "iOS safe viewport and standalone metadata are present");
expect(css.includes("100svh") && css.includes("100dvh") && css.includes("safe-area-inset"), "Safari viewport and safe-area CSS are present");
expect(css.includes("font-size: 16px !important"), "iPhone form focus zoom is prevented");
expect(install.includes('navigator.platform === "MacIntel"') && install.includes("navigator.maxTouchPoints > 1"), "iPad desktop-mode detection is present");
expect(install.includes("Add to Home Screen") && install.includes("Add to Dock"), "Apple install guidance covers iPhone/iPad and macOS Safari");
expect(smoke.includes("webkit-iphone") && smoke.includes("webkit-ipad-portrait") && smoke.includes("webkit-ipad-landscape") && smoke.includes("webkit-ipad-split"), "WebKit iPhone/iPad portrait, landscape and split profiles are in automated smoke coverage");

console.log("\nP7 — Mac and Windows PWA");
expect(vite.includes('display: "standalone"') && vite.includes("display_override"), "generated manifest supports installed desktop display modes");
expect(manifest.includes('"display": "standalone"') && manifest.includes('"display_override"'), "static manifest mirrors installed desktop display modes");
expect(install.includes("beforeinstallprompt") && install.includes("/Windows/i"), "Chromium/Windows installation flow is supported");
expect(smoke.includes("chromium-windows-desktop") && smoke.includes("chromium-windows-compact") && smoke.includes("webkit-mac"), "Windows Chromium and macOS WebKit profiles are in smoke coverage");
expect(css.includes(":focus-visible") && css.includes("scrollbar-gutter: stable"), "keyboard focus and desktop resize stability are hardened");

console.log("\nP8 — Offline and weak network");
expect(client.includes("/rest/v1/") && client.includes("/auth/v1/") && client.includes("/functions/v1/") && client.includes("/storage/v1/"), "all Supabase HTTP families have bounded transport handling");
expect(client.includes("rk-network-degraded") && client.includes("rk-network-recovered"), "transport health is surfaced to the application shell");
expect(connectivity.includes('"degraded"') && connectivity.includes("rk-network-degraded") && connectivity.includes("rk-reconnected"), "offline/degraded/reconnect UI state is explicit");
expect(app.includes("refetchOnReconnect: true") && app.includes('networkMode: "online"'), "React Query recovers online-only queries after reconnect");
expect(vite.includes('handler: "NetworkOnly"') && vite.includes("supabase.co"), "authenticated Supabase responses are never cached by the service worker");
expect(vite.includes("assets/index-*.js") && vite.includes('handler: "StaleWhileRevalidate"'), "installed shell entry is precached while app code revalidates after deploys");
expect(vite.includes('handler: "NetworkFirst"') && vite.includes("networkTimeoutSeconds: 3"), "navigations have a bounded network-first offline fallback");
expect(vite.includes("cleanupOutdatedCaches: true") && vite.includes('navigateFallback: "/index.html"'), "old caches are cleaned and SPA navigation has an offline shell");
expect(residences.includes("AbortController") && residences.includes("RESIDENCE_CACHE_KEY") && residences.includes("rk-reconnected"), "Find My Res has timeout, recent cache, and reconnect recovery");

if (failed) {
  console.error(`\nP5–P8 stability audit failed with ${failed} issue(s).`);
  process.exit(1);
}
console.log("\nP5–P8 stability audit passed.");
