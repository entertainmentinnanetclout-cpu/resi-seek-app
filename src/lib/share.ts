// Universal share helpers — canonical URLs + dynamic OG images

import { EXTERNAL_SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { PUBLIC_SITE_ORIGIN } from "@/lib/publicUrl";

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
    url = `${PUBLIC_SITE_ORIGIN}${base}=${encodeURIComponent(id)}`;
  } else {
    url = `${PUBLIC_SITE_ORIGIN}${path}`;
  }
  return `${url}${url.includes("?") ? "&" : "?"}utm_source=share&utm_medium=social`;
}

/**
 * Dynamic Open Graph card (1200x630) rendered by the og-image edge function.
 */
export function getOgImageUrl(type: ShareableType, id: string): string {
  return `https://${PROJECT_ID}.supabase.co/functions/v1/og-image?type=${type}&id=${encodeURIComponent(id)}`;
}
