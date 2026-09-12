// Universal share helpers — canonical URLs + dynamic OG images

import { EXTERNAL_SUPABASE_PROJECT_ID } from "@/integrations/supabase/client";
import { PUBLIC_SITE_ORIGIN } from "@/lib/publicUrl";

const PROJECT_ID = EXTERNAL_SUPABASE_PROJECT_ID;

export type ShareableType = "product" | "hamper" | "deal" | "residence" | "bursary";
export type ShareAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  campaignCode?: string;
};

const PATH_MAP: Record<ShareableType, string> = {
  product: "/product",
  hamper: "/marketplace?tab=hampers&id",
  deal: "/discounts?id",
  residence: "/residence",
  bursary: "/bursary",
};

/**
 * Canonical share URL. Existing callers keep the generic share/social tags;
 * Luna/Metricool campaigns can add a stable campaign code and content variant.
 */
export function getShareUrl(type: ShareableType, id: string, slug?: string, attribution: ShareAttribution = {}): string {
  const base = PATH_MAP[type] || "/";
  const path = slug ? `${base}/${slug}` : `${base}/${id}`;
  const raw = base.includes("?")
    ? `${PUBLIC_SITE_ORIGIN}${base}=${encodeURIComponent(id)}`
    : `${PUBLIC_SITE_ORIGIN}${path}`;
  const url = new URL(raw);
  url.searchParams.set("utm_source", attribution.source || "share");
  url.searchParams.set("utm_medium", attribution.medium || "social");
  if (attribution.campaign) url.searchParams.set("utm_campaign", attribution.campaign);
  if (attribution.content) url.searchParams.set("utm_content", attribution.content);
  if (attribution.term) url.searchParams.set("utm_term", attribution.term);
  if (attribution.campaignCode) url.searchParams.set("rk_campaign", attribution.campaignCode);
  return url.toString();
}

/**
 * Dynamic Open Graph card (1200x630) rendered by the og-image edge function.
 */
export function getOgImageUrl(type: ShareableType, id: string): string {
  return `https://${PROJECT_ID}.supabase.co/functions/v1/og-image?type=${type}&id=${encodeURIComponent(id)}`;
}
