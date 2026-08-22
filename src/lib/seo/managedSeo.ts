import { supabase } from "@/integrations/supabase/client";

export interface ManagedSeoFact {
  label: string;
  value: string;
}

export interface ManagedSeoBlock {
  heading: string;
  paragraphs: string[];
}

export interface ManagedSeoCta {
  label?: string;
  to?: string;
}

export interface ManagedSeoPageRecord {
  path: string;
  title: string;
  description: string;
  h1: string;
  primary_keyword: string | null;
  search_intent: string | null;
  canonical_path: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  schema_type: string | null;
  schema_data: Record<string, unknown> | null;
  breadcrumbs: unknown;
  updated_at: string | null;
  last_verified_at: string | null;
  answer_summary: string | null;
  content_blocks: ManagedSeoBlock[];
  entity_facts: ManagedSeoFact[];
  cta: ManagedSeoCta;
  locale: string;
  search_territory: string[];
  quality_score: number;
  unique_data_score: number;
  content_completeness: number;
  ai_citation_ready: boolean;
}

export interface ManagedSeoLink {
  to_path: string;
  anchor_text: string;
  relation_type: string;
  sort_order: number;
}

const db = supabase as any;

export const normalizeSeoPath = (path: string) => {
  if (!path || path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
};

export async function getManagedSeoPage(path: string): Promise<ManagedSeoPageRecord | null> {
  const normalized = normalizeSeoPath(path);
  const { data, error } = await db
    .from("seo_public_pages_v")
    .select("*")
    .eq("path", normalized)
    .maybeSingle();

  if (error) throw error;
  return (data as ManagedSeoPageRecord | null) ?? null;
}

export async function getManagedSeoLinks(path: string): Promise<ManagedSeoLink[]> {
  const normalized = normalizeSeoPath(path);
  const { data, error } = await db
    .from("seo_page_links")
    .select("to_path,anchor_text,relation_type,sort_order")
    .eq("from_path", normalized)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data as ManagedSeoLink[] | null) ?? [];
}

export async function getPublishedPropertyOpportunities() {
  const { data, error } = await db
    .from("property_opportunities")
    .select("id,slug,name,opportunity_type,status,address,suburb,city,province,asking_price,price_basis,auction_date,advertised_bed_capacity,units_count,nearest_institution,accreditation_claim,source_name,source_url,summary,reskonnect_score,investment_score,risk_score,last_verified_at,updated_at")
    .eq("is_published", true)
    .order("last_verified_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}
