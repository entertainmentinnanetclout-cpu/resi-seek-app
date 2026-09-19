// Android 1.1.2: isolate native boot from browser-only growth and map enhancements.
import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { initLunaAttribution } from "@/lib/lunaGrowth";
import "./index.css";
import "./styles/mobile-foundation.css";
import { isNativeApp } from "@/lib/accountRouting";

const ResMapLiveStreetViewBridge = lazy(() => import("@/components/resmap/ResMapLiveStreetViewBridge"));
const native = isNativeApp();
const CANONICAL_ORIGIN = "https://www.reskonnect.org";
const currentHost = window.location.hostname.toLowerCase();
const alternatePublicHosts = new Set(["reskonnect.org", "reskonnect.co.za", "www.reskonnect.co.za"]);
const shouldCanonicalize = !native && (currentHost.endsWith(".vercel.app") || alternatePublicHosts.has(currentHost));

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
  if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(run, { timeout: 1600 });
  else window.setTimeout(run, 900);
}

// No email, passwords or conversation content are captured. The last error
// marker can help distinguish a JS failure from an Android renderer/process kill.
if (native) {
  const record = (kind: string, detail: unknown) => {
    try {
      window.localStorage.setItem("rk_native_last_js_failure_v1", JSON.stringify({
        kind,
        message: String(detail ?? "unknown").slice(0, 180),
        route: window.location.pathname,
        time: new Date().toISOString(),
      }));
    } catch { /* Storage failure must not crash app boot. */ }
  };
  window.addEventListener("error", event => record("error", event.message));
  window.addEventListener("unhandledrejection", event => record("promise", event.reason instanceof Error ? event.reason.message : "Unhandled promise rejection"));
}

if (shouldCanonicalize) {
  const target = `${CANONICAL_ORIGIN}${window.location.pathname}${window.location.search}${window.location.hash}`;
  window.location.replace(target);
} else {
  // Native assets are delivered by Google Play, not the website service worker.
  if (native && "serviceWorker" in navigator) {
    void navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
      .catch(() => undefined);
  }
  if (!native && "caches" in window) {
    void caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("supabase-cache")).map(key => caches.delete(key))))
      .catch(() => undefined);
  }

  if (!native) scheduleNonCriticalBoot();
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
      {!native && <DeferredResMapBridge />}
    </HelmetProvider>
  );
}
