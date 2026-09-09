export const PUBLIC_SITE_ORIGIN = "https://www.reskonnect.org";

export function publicUrl(path = "/"): string {
  if (!path) return PUBLIC_SITE_ORIGIN;
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      return `${PUBLIC_SITE_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return PUBLIC_SITE_ORIGIN;
    }
  }
  return `${PUBLIC_SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function authRedirectUrl(path: string): string {
  const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase() : "";
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return publicUrl(path);
}
