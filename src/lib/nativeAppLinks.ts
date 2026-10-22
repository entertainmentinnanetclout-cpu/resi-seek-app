import { isNativeApp } from "@/lib/accountRouting";

const ALLOWED_HOSTS = new Set(["www.reskonnect.org"]);
let stopListener: (() => void) | null = null;
let starting = false;

function appPlugin(): any {
  return isNativeApp() ? (window as any).Capacitor?.Plugins?.App : null;
}

export function safeNativeRoute(rawUrl: unknown): string | null {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048) return null;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    const path = `${url.pathname || "/"}${url.search}${url.hash}`;
    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/_") || path.startsWith("/api/")) return null;
    return path.slice(0, 1800);
  } catch {
    return null;
  }
}

function openRoute(rawUrl: unknown, replace = false) {
  const route = safeNativeRoute(rawUrl);
  if (!route) return false;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === route) return true;
  if (replace) window.history.replaceState(window.history.state, "", route);
  else window.history.pushState(window.history.state, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return true;
}

/**
 * Installs one Android App Links listener for the native shell. Only verified
 * HTTPS links for the canonical ResKonnect host are allowed to become internal
 * routes. The native Activity remains singleTask so warm-link launches reuse
 * the existing authenticated WebView instead of starting a second app copy.
 */
export async function startNativeAppLinks() {
  if (!isNativeApp() || stopListener || starting) return;
  const app = appPlugin();
  if (!app?.addListener || !app?.getLaunchUrl) return;
  starting = true;
  try {
    let active = true;
    let handle: any = null;
    handle = await app.addListener("appUrlOpen", (event: any) => {
      if (active) openRoute(event?.url, false);
    });
    stopListener = () => {
      active = false;
      stopListener = null;
      void handle?.remove?.();
    };

    const launch = await app.getLaunchUrl().catch(() => null);
    if (launch?.url) openRoute(launch.url, true);
  } catch (error) {
    console.warn("[native-links] App Links listener unavailable", error);
    stopListener = null;
  } finally {
    starting = false;
  }
}

export function stopNativeAppLinks() {
  stopListener?.();
}
