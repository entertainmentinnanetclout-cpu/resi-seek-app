// Universal share helpers — canonical URLs + dynamic OG images

const SITE_URL = "https://www.reskonnect.org";
import { EXTERNAL_SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";

const PROJECT_ID = EXTERNAL_SUPABASE_PROJECT_ID;

export type ShareableType = "product" | "hamper" | "deal" | "residence" | "bursary";

const PATH_MAP: Record<ShareableType, string> = {
  product: "/product",
  hamper: "/marketplace?tab=hampers&id",
  deal: "/discounts?id",
  residence: "/residence",
  bursary: "/bursary",
};

/**
 * Canonical share URL (with utm tags so you can track viral coefficient).
 */
export function getShareUrl(type: ShareableType, id: string, slug?: string): string {
  const base = PATH_MAP[type] || "/";
  const path = slug ? `${base}/${slug}` : `${base}/${id}`;
  // For query-style entries (hamper/deal) build differently
  let url: string;
  if (base.includes("?")) {
    url = `${SITE_URL}${base}=${encodeURIComponent(id)}`;
  } else {
    url = `${SITE_URL}${path}`;
  }
  return `${url}${url.includes("?") ? "&" : "?"}utm_source=share&utm_medium=social`;
}

/**
 * Dynamic Open Graph card (1200x630) rendered by the og-image edge function.
 */
export function getOgImageUrl(type: ShareableType, id: string): string {
  return `https://${PROJECT_ID}.supabase.co/functions/v1/og-image?type=${type}&id=${encodeURIComponent(id)}`;
}
