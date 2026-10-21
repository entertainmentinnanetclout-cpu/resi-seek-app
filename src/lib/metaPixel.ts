export type MarketingConsent = "granted" | "denied" | null;

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
      push?: (...args: unknown[]) => void;
    };
    _fbq?: Window["fbq"];
    __rkMetaPixelInitialized?: boolean;
  }
}

export const META_PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID || "950382421094982").trim();
export const MARKETING_CONSENT_KEY = "reskonnect_marketing_consent_v1";
export const MARKETING_CONSENT_EVENT = "reskonnect:marketing-consent";
export const MARKETING_PREFERENCES_EVENT = "reskonnect:open-marketing-preferences";

export const getMarketingConsent = (): MarketingConsent => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(MARKETING_CONSENT_KEY);
  return value === "granted" || value === "denied" ? value : null;
};

export const setMarketingConsent = (value: Exclude<MarketingConsent, null>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MARKETING_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent(MARKETING_CONSENT_EVENT, { detail: value }));
};

export const openMarketingPreferences = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MARKETING_PREFERENCES_EVENT));
};

export const initMetaPixel = () => {
  if (typeof window === "undefined" || !META_PIXEL_ID || getMarketingConsent() !== "granted") return false;
  if (window.__rkMetaPixelInitialized && window.fbq) return true;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    } as NonNullable<Window["fbq"]>;
    fbq.push = (...args: unknown[]) => fbq(...args);
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.reskonnectMetaPixel = "true";
    document.head.appendChild(script);
  }

  window.fbq?.("init", META_PIXEL_ID);
  window.__rkMetaPixelInitialized = true;
  return true;
};

const safeParams = (params?: Record<string, unknown>) => {
  if (!params) return undefined;
  // Only allow campaign/content metadata. Never send student identity, contact,
  // application documents, funding records or other personal/sensitive fields.
  const allow = new Set([
    "content_name",
    "content_category",
    "content_type",
    "content_ids",
    "search_string",
    "value",
    "currency",
    "status",
    "source",
  ]);
  return Object.fromEntries(Object.entries(params).filter(([key]) => allow.has(key)));
};

export const trackMetaEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (typeof window === "undefined" || getMarketingConsent() !== "granted") return;
  if (!initMetaPixel()) return;
  window.fbq?.("track", eventName, safeParams(params));
};

export const trackMetaCustomEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (typeof window === "undefined" || getMarketingConsent() !== "granted") return;
  if (!initMetaPixel()) return;
  window.fbq?.("trackCustom", eventName, safeParams(params));
};
