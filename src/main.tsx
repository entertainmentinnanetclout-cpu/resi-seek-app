// Build: 2026-09-09 - Link routing hardening + ResMap route Street View bridge
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ResMapLiveStreetViewBridge from "@/components/resmap/ResMapLiveStreetViewBridge";
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

if (shouldCanonicalize) {
  const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
} else {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
      <ResMapLiveStreetViewBridge />
    </HelmetProvider>
  );
}
