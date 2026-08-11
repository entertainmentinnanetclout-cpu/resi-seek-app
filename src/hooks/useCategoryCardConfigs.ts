import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { UserIntent } from "@/lib/intent/userIntentTypes";

/**
 * Admin-controlled Living category cards.
 *
 * Images always come from real data (admin selection -> selected residence ->
 * matching residence pool -> any real residence -> neutral placeholder).
 * No AI/stock imagery is used anywhere in this resolver.
 *
 * NOTE: `category_card_configs` and `private_rental_listings` are not yet in the
 * generated Supabase types, so those queries are cast locally.
 */

export type FallbackStrategy = "residence_pool" | "custom_url" | "selected_residence";

export interface CategoryCardConfig {
  id: string;
  card_key: string;
  title: string;
  description: string | null;
  route_path: string;
  cta_label: string | null;
  filter_payload: Record<string, any>;
  selected_residence_id: string | null;
  selected_image_url: string | null;
  fallback_strategy: FallbackStrategy | string | null;
  image_alt: string | null;
  display_order: number | null;
  is_active: boolean;
}

export interface ResidenceLite {
  id: string;
  name: string;
  campus: string | null;
  address: string | null;
  price: number | null;
  available_spots: number | null;
  image_url: string | null;
  images: string[] | null;
  accepts_university: boolean | null;
  accepts_tvet: boolean | null;
  accepts_private: boolean | null;
  accepts_nsfas: boolean | null;
  institution_tags: string[] | null;
}

export interface ResolvedCategoryCard extends CategoryCardConfig {
  imageUrl: string | null;
  imageAlt: string;
  imageSourceResidenceId: string | null;
  imageSource: "admin_custom_url" | "admin_residence" | "matching_pool" | "any_residence" | "private_rental" | "none";
  intent: Partial<UserIntent>;
}

const MOCK_NAME = /^(example|demo|test|sample|placeholder)\b/i;

export const firstResidenceImage = (r?: ResidenceLite | null): string | null => {
  if (!r) return null;
  const fromArray = Array.isArray(r.images) ? r.images.find((i) => typeof i === "string" && i.trim()) : null;
  return (fromArray || (r.image_url && r.image_url.trim() ? r.image_url : null)) ?? null;
};

/** Stable per-session shuffle seed so cards do not flicker between renders. */
const SESSION_SEED = Math.floor(Math.random() * 100000);

const seededPick = (list: ResidenceLite[], seed: number): ResidenceLite | null => {
  if (!list.length) return null;
  return list[(seed * 9301 + 49297) % 233280 % list.length];
};

const routeFor = (cfg: CategoryCardConfig): string => {
  // The DB stores logical paths; normalise the few that differ from the router.
  if (cfg.card_key === "private_rentals") return "/living/private-rentals";
  return cfg.route_path || "/find";
};

const intentFor = (cfg: CategoryCardConfig): Partial<UserIntent> => {
  const p = cfg.filter_payload || {};
  const base: Partial<UserIntent> = {
    completed_guide: true,
    skipped_guide: false,
  };
  switch (cfg.card_key) {
    case "private_rentals":
      return {
        ...base,
        persona: "private_tenant",
        primary_need: "private_rental",
        looking_for_private_rental: true,
        looking_for_student_accommodation: false,
      };
    case "parent_guidance":
      return { ...base, persona: "parent_guardian", parent_mode: true };
    case "nsfas_residences":
      return {
        ...base,
        persona: "student",
        primary_need: "accommodation",
        looking_for_student_accommodation: true,
        funding_type: "nsfas",
        nsfas_funded: true,
      };
    case "private_paying_student":
      return {
        ...base,
        persona: "student",
        primary_need: "accommodation",
        looking_for_student_accommodation: true,
        funding_type: "private",
        student_status: "current_student",
      };
    default:
      return {
        ...base,
        persona: "student",
        primary_need: "accommodation",
        looking_for_student_accommodation: true,
        ...(p.institution_type ? { institution_type: p.institution_type } : {}),
      };
  }
};

const matchesPayload = (r: ResidenceLite, payload: Record<string, any>): boolean => {
  if (payload.accepts_university && !r.accepts_university) return false;
  if (payload.accepts_tvet && !r.accepts_tvet) return false;
  if (payload.accepts_private && !r.accepts_private) return false;
  if (payload.accepts_nsfas && !r.accepts_nsfas) return false;
  return true;
};

export const useCategoryCardConfigs = () => {
  const configsQuery = useQuery({
    queryKey: ["category_card_configs"],
    queryFn: async (): Promise<CategoryCardConfig[]> => {
      const { data, error } = await (supabase as any)
        .from("category_card_configs")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as CategoryCardConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const residencesQuery = useQuery({
    queryKey: ["category_card_residence_pool"],
    queryFn: async (): Promise<ResidenceLite[]> => {
      const { data, error } = await supabase
        .from("residences")
        .select(
          "id,name,campus,address,price,available_spots,image_url,images,accepts_university,accepts_tvet,accepts_private,accepts_nsfas,institution_tags"
        )
        .order("name");
      if (error) throw error;
      return ((data || []) as unknown as ResidenceLite[]).filter((r) => !MOCK_NAME.test(String(r.name || "").trim()));
    },
    staleTime: 5 * 60 * 1000,
  });

  const rentalsQuery = useQuery({
    queryKey: ["private_rental_listing_images"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any)
        .from("private_rental_listings")
        .select("image_url,images")
        .limit(20);
      if (error) return [];
      return ((data || []) as any[])
        .map((l) => (Array.isArray(l.images) ? l.images.find((i: any) => typeof i === "string" && i.trim()) : null) || l.image_url)
        .filter((u: any) => typeof u === "string" && u.trim());
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const residences = residencesQuery.data ?? [];
  const configs = configsQuery.data ?? [];
  const rentalImages = rentalsQuery.data ?? [];

  const cards = useMemo<ResolvedCategoryCard[]>(() => {
    const withImages = residences.filter((r) => !!firstResidenceImage(r));
    const used = new Set<string>();

    return configs.map((cfg, index) => {
      let imageUrl: string | null = null;
      let imageSource: ResolvedCategoryCard["imageSource"] = "none";
      let sourceId: string | null = null;

      // 1. Admin custom URL
      if (cfg.selected_image_url && cfg.selected_image_url.trim()) {
        imageUrl = cfg.selected_image_url.trim();
        imageSource = "admin_custom_url";
      }

      // 2. Admin selected residence
      if (!imageUrl && cfg.selected_residence_id) {
        const picked = residences.find((r) => r.id === cfg.selected_residence_id);
        const url = firstResidenceImage(picked);
        if (url) {
          imageUrl = url;
          sourceId = picked!.id;
          imageSource = "admin_residence";
        }
      }

      // 3. Private rentals use real rental listing images only
      if (!imageUrl && cfg.card_key === "private_rentals") {
        const fresh = rentalImages.find((u) => !used.has(u)) ?? rentalImages[0];
        if (fresh) {
          imageUrl = fresh;
          imageSource = "private_rental";
        }
      }

      // 4. Matching residence pool from filter_payload (dedupe across cards)
      if (!imageUrl && cfg.card_key !== "private_rentals") {
        const pool = withImages.filter((r) => matchesPayload(r, cfg.filter_payload || {}));
        const unused = pool.filter((r) => !used.has(firstResidenceImage(r) as string));
        const picked = seededPick(unused.length ? unused : pool, SESSION_SEED + index * 17);
        const url = firstResidenceImage(picked);
        if (url) {
          imageUrl = url;
          sourceId = picked!.id;
          imageSource = "matching_pool";
        }
      }

      // 5. Any real residence image as last resort
      if (!imageUrl) {
        const unused = withImages.filter((r) => !used.has(firstResidenceImage(r) as string));
        const picked = seededPick(unused.length ? unused : withImages, SESSION_SEED + index * 31);
        const url = firstResidenceImage(picked);
        if (url) {
          imageUrl = url;
          sourceId = picked!.id;
          imageSource = "any_residence";
        }
      }

      if (imageUrl) used.add(imageUrl);

      return {
        ...cfg,
        route_path: routeFor(cfg),
        imageUrl,
        imageAlt: cfg.image_alt || cfg.title,
        imageSourceResidenceId: sourceId,
        imageSource,
        intent: intentFor(cfg),
      };
    });
  }, [configs, residences, rentalImages]);

  return {
    cards,
    residences,
    isLoading: configsQuery.isLoading || residencesQuery.isLoading,
    error: configsQuery.error as Error | null,
  };
};
