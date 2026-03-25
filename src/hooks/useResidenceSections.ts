import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResidenceSection {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  display_order: number;
  color: string;
  is_active: boolean;
  applies_to: string;
}

export function useResidenceSections(appliesTo?: "trusted" | "findmyres" | "both") {
  const [sections, setSections] = useState<ResidenceSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        let query = supabase
          .from("residence_sections")
          .select("*")
          .eq("is_active", true)
          .order("display_order", { ascending: true });

        if (appliesTo && appliesTo !== "both") {
          query = query.or(`applies_to.eq.${appliesTo},applies_to.eq.both`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setSections(data || []);
      } catch (err) {
        console.error("[useResidenceSections] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [appliesTo]);

  return { sections, loading };
}
