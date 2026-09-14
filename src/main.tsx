// Build: 2026-09-13 - Android 1.1.0 speed/session reliability boot
import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { initLunaAttribution } from "@/lib/lunaGrowth";
import "./index.css";
import "./styles/mobile-foundation.css";
import { isNativeApp } from "@/lib/accountRouting";

const ResMapLiveStreetViewBridge = lazy(() => import("@/components/resmap/ResMapLiveStreetViewBridge"));

const CANONICAL_ORIGIN = "https://www.reskonnect.org";
const currentHost = window.location.hostname.toLowerCase();
const alternatePublicHosts = new Set(["reskonnect.org", "reskonnect.co.za", "www.reskonnect.co.za"]);
const shouldCanonicalize = currentHost.endsWith(".vercel.app") || alternatePublicHosts.has(currentHost);

function DeferredResMapBridge() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const win = window as any;
    if (typeof win.requestIdleCallback === "function") {
      const id = win.requestIdleCallback(() => setReady(true), { timeout: 2200 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);
  if (!ready) return null;
  return <Suspense fallback={null}><ResMapLiveStreetViewBridge /></Suspense>;
}

function scheduleNonCriticalBoot() {
  const run = () => { void initLunaAttribution(); };
  const win = window as any;
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(run, { timeout: 1600 });
  } else {
    window.setTimeout(run, 900);
  }
}

if (shouldCanonicalize) {
  const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
} else {
  // Packaged native assets are versioned by Google Play, not a website worker.
  // Remove only native-origin worker registrations; never clear auth storage.
  if (isNativeApp() && "serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => undefined);
  }
  // Purge only the historical API runtime cache from pre-zero-trust PWA builds.
  // Static route assets remain cacheable and authenticated API responses stay NetworkOnly.
  if ("caches" in window) {
    void caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("supabase-cache")).map((key) => caches.delete(key))))
      .catch(() => undefined);
  }

  scheduleNonCriticalBoot();
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
      <DeferredResMapBridge />
    </HelmetProvider>
  );
}
