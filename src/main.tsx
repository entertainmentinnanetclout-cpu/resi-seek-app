// Build: 2026-09-10 - Luna AgentOS RG0-RG2 attribution boot
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ResMapLiveStreetViewBridge from "@/components/resmap/ResMapLiveStreetViewBridge";
import { initLunaAttribution } from "@/lib/lunaGrowth";
import "./index.css";
import "./styles/mobile-foundation.css";

const CANONICAL_ORIGIN = "https://www.reskonnect.org";
const currentHost = window.location.hostname.toLowerCase();
const alternatePublicHosts = new Set([
  "reskonnect.org",
  "reskonnect.co.za",
  "www.reskonnect.co.za",
]);
const shouldCanonicalize =
  currentHost.endsWith(".vercel.app") || alternatePublicHosts.has(currentHost);


const purgeLegacySensitiveCaches = async () => {
  if (!("caches" in window)) return;
  try {
    const names = await caches.keys();
    const sensitiveLegacy = new Set(["supabase-cache-v2", "navigation-pages-v2"]);
    await Promise.all(names.filter((name) => sensitiveLegacy.has(name)).map((name) => caches.delete(name)));
  } catch (error) {
    console.warn("[security] legacy cache cleanup failed", error);
  }
};

if (shouldCanonicalize) {
  const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
} else {
  void purgeLegacySensitiveCaches();
  void initLunaAttribution();
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
      <ResMapLiveStreetViewBridge />
    </HelmetProvider>
  );
}
