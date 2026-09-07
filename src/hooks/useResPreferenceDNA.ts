import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_DNA, type PreferenceDNA } from "@/lib/resmap/match";

const STORAGE_KEY = "reskonnect_res_preference_dna_v1";

function readLocal(): PreferenceDNA {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_DNA, ...JSON.parse(raw) } : DEFAULT_DNA;
  } catch { return DEFAULT_DNA; }
}

export function useResPreferenceDNA() {
  const { user } = useAuth();
  const [dna, setDna] = useState<PreferenceDNA>(() => typeof window === "undefined" ? DEFAULT_DNA : readLocal());
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    (async () => {
      const { data } = await (supabase as any).from("resmap_preference_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (!active) return;
      if (data) {
        const next: PreferenceDNA = {
          ...DEFAULT_DNA,
          campus: data.campus || undefined,
          institutionType: data.institution_type || undefined,
          institutionTag: data.institution_tag || undefined,
          fundingType: data.funding_type || undefined,
          budgetMin: Number(data.budget_min || 0),
          budgetMax: Number(data.budget_max || 10000),
          roomTypes: data.room_types || [], amenities: data.amenities || [], priorities: data.priorities || DEFAULT_DNA.priorities,
          styleTags: data.style_tags || [], travelMode: data.travel_mode || "walk", maxTravelMinutes: data.max_travel_minutes,
          groupSize: Number(data.group_size || 1),
        };
        setDna(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const save = useCallback(async (next: PreferenceDNA) => {
    setDna(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (!user) return;
    await (supabase as any).from("resmap_preference_profiles").upsert({
      user_id: user.id, campus: next.campus || null, institution_type: next.institutionType || null, institution_tag: next.institutionTag || null,
      funding_type: next.fundingType || null, budget_min: next.budgetMin, budget_max: next.budgetMax, room_types: next.roomTypes,
      amenities: next.amenities, priorities: next.priorities, style_tags: next.styleTags, travel_mode: next.travelMode,
      max_travel_minutes: next.maxTravelMinutes ?? null, group_size: next.groupSize, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }, [user]);

  const patch = useCallback((values: Partial<PreferenceDNA>) => save({ ...dna, ...values }), [dna, save]);
  return { dna, save, patch, loading, isSynced: Boolean(user) };
}
