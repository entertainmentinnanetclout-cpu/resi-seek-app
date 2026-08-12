import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarDays,
  FileText,
  GraduationCap,
  HandCoins,
  Home,
  Landmark,
  Loader2,
  Newspaper,
  Percent,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type SearchResult = {
  id: string;
  label: string;
  description: string;
  category: string;
  path: string;
  icon: typeof Search;
  keywords?: string[];
};

const STATIC_RESULTS: SearchResult[] = [
  {
    id: "home",
    label: "Home",
    description: "ResKonnect home and student journey overview",
    category: "Page",
    path: "/",
    icon: Home,
    keywords: ["landing", "reskonnect"],
  },
  {
    id: "applications",
    label: "Applications & Course Match",
    description: "TUT, UP, UNISA, APS, programme matching, TVET and private colleges",
    category: "Applications",
    path: "/apply",
    icon: GraduationCap,
    keywords: ["tut", "up", "unisa", "aps", "course", "university", "college", "tvet", "apply"],
  },
  {
    id: "accommodation",
    label: "Find Accommodation",
    description: "Search residences and student accommodation",
    category: "Living",
    path: "/find",
    icon: Building2,
    keywords: ["res", "residence", "housing", "room", "nsfas", "student accommodation"],
  },
  {
    id: "private-rentals",
    label: "Private Rentals",
    description: "Private rental support and housing options",
    category: "Living",
    path: "/living/private-rentals",
    icon: Building2,
    keywords: ["flat", "apartment", "rent", "private accommodation"],
  },
  {
    id: "bursaries",
    label: "Bursaries",
    description: "Funding opportunities and bursary listings",
    category: "Funding",
    path: "/bursaries",
    icon: HandCoins,
    keywords: ["funding", "scholarship", "money"],
  },
  {
    id: "wil",
    label: "WIL & Opportunities",
    description: "Work-integrated learning, internships and opportunities",
    category: "Opportunities",
    path: "/opportunities/wil",
    icon: FileText,
    keywords: ["wil", "internship", "work", "placement", "career", "jobs"],
  },
  {
    id: "news",
    label: "Campus News",
    description: "Campus articles, notices and updates",
    category: "Campus",
    path: "/campus-news",
    icon: Newspaper,
    keywords: ["news", "updates", "articles"],
  },
  {
    id: "events",
    label: "Campus Events",
    description: "Find upcoming student and campus events",
    category: "Campus",
    path: "/events",
    icon: CalendarDays,
    keywords: ["event", "activities", "campus"],
  },
  {
    id: "discounts",
    label: "Student Discounts",
    description: "Student deals and discounts",
    category: "Student life",
    path: "/discounts",
    icon: Percent,
    keywords: ["deal", "discount", "offer", "save"],
  },
  {
    id: "roommates",
    label: "Find Roommates",
    description: "Roommate and sharing options",
    category: "Living",
    path: "/roommates",
    icon: Users,
    keywords: ["roommate", "flatmate", "sharing"],
  },
  {
    id: "partners",
    label: "Partners",
    description: "Landlords, institutions and ResKonnect partner solutions",
    category: "Partners",
    path: "/partners",
    icon: Landmark,
    keywords: ["landlord", "institution", "partner", "property"],
  },
];

const safeSearchTerm = (value: string) =>
  value
    .replace(/[,()'"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

const categoryToHubQuery = (category: string) => {
  if (category === "tvet") return "tvet";
  if (category === "private_college") return "private_college";
  return "university";
};

interface PublicQuickSearchProps {
  className?: string;
  label?: string;
}

const PublicQuickSearch = ({ className, label = "Quick Search" }: PublicQuickSearchProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [dynamicResults, setDynamicResults] = useState<SearchResult[]>([]);

  const staticMatches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return STATIC_RESULTS.slice(0, 8);
    return STATIC_RESULTS.filter((item) => {
      const haystack = [item.label, item.description, item.category, ...(item.keywords ?? [])]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    }).slice(0, 8);
  }, [query]);

  useEffect(() => {
    const normalized = safeSearchTerm(query);
    if (normalized.length < 2) {
      setDynamicResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const pattern = `%${normalized}%`;

      const [institutions, residences, programmes, bursaries, news, events] = await Promise.all([
        (supabase as any)
          .from("application_hub_institutions")
          .select("id,institution_id,slug,category,short_name,display_name,description,matcher_key")
          .eq("is_active", true)
          .or(`display_name.ilike.${pattern},short_name.ilike.${pattern},description.ilike.${pattern}`)
          .limit(6),
        (supabase as any)
          .from("residences_public")
          .select("id,name,description")
          .or(`name.ilike.${pattern},description.ilike.${pattern}`)
          .limit(6),
        (supabase as any)
          .from("programmes")
          .select("id,institution_id,name,qualification_type,faculty_or_school,campus")
          .eq("is_active", true)
          .or(`name.ilike.${pattern},qualification_type.ilike.${pattern},faculty_or_school.ilike.${pattern},campus.ilike.${pattern}`)
          .limit(8),
        (supabase as any)
          .from("bursaries")
          .select("id,name,provider,description")
          .eq("is_active", true)
          .or(`name.ilike.${pattern},provider.ilike.${pattern},description.ilike.${pattern}`)
          .limit(5),
        (supabase as any)
          .from("campus_news")
          .select("id,title,excerpt,category")
          .eq("is_published", true)
          .or(`title.ilike.${pattern},excerpt.ilike.${pattern},category.ilike.${pattern}`)
          .limit(4),
        (supabase as any)
          .from("events")
          .select("id,title,location,description")
          .or(`title.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern}`)
          .limit(4),
      ]);

      if (cancelled) return;

      const rows: SearchResult[] = [];
      const institutionRows = institutions.data ?? [];
      const institutionById = new Map(
        institutionRows
          .filter((row: any) => row.institution_id)
          .map((row: any) => [String(row.institution_id), row]),
      );

      for (const row of institutionRows) {
        const category = categoryToHubQuery(String(row.category));
        const params = new URLSearchParams({ category });
        if (row.matcher_key) params.set("institution", String(row.matcher_key));
        rows.push({
          id: `institution-${row.id}`,
          label: row.display_name,
          description: row.description || `${row.short_name} application and Course Match options`,
          category: "Institution",
          path: `/apply?${params.toString()}`,
          icon: Landmark,
        });
      }

      for (const row of residences.data ?? []) {
        rows.push({
          id: `residence-${row.id}`,
          label: row.name,
          description: row.description || "Student accommodation",
          category: "Residence",
          path: `/res/${row.id}`,
          icon: Building2,
        });
      }

      for (const row of programmes.data ?? []) {
        const institution = institutionById.get(String(row.institution_id));
        const params = new URLSearchParams({ category: "university" });
        if (institution?.matcher_key) params.set("institution", String(institution.matcher_key));
        rows.push({
          id: `programme-${row.id}`,
          label: row.name,
          description: [institution?.short_name, row.qualification_type, row.faculty_or_school, row.campus]
            .filter(Boolean)
            .join(" • ") || "Academic programme",
          category: "Programme",
          path: `/apply?${params.toString()}`,
          icon: GraduationCap,
        });
      }

      for (const row of bursaries.data ?? []) {
        rows.push({
          id: `bursary-${row.id}`,
          label: row.name,
          description: [row.provider, row.description].filter(Boolean).join(" • "),
          category: "Bursary",
          path: `/bursary/${row.id}`,
          icon: HandCoins,
        });
      }

      for (const row of news.data ?? []) {
        rows.push({
          id: `news-${row.id}`,
          label: row.title,
          description: row.excerpt || row.category || "Campus news",
          category: "News",
          path: "/campus-news",
          icon: Newspaper,
        });
      }

      for (const row of events.data ?? []) {
        rows.push({
          id: `event-${row.id}`,
          label: row.title,
          description: [row.location, row.description].filter(Boolean).join(" • "),
          category: "Event",
          path: "/events",
          icon: CalendarDays,
        });
      }

      setDynamicResults(rows.slice(0, 24));
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const choose = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.path);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => setOpen(true)}
        className={cn(
          "border-white/30 bg-white/10 text-white shadow-lg backdrop-blur-md hover:bg-white/20 hover:text-white",
          className,
        )}
      >
        <Search className="mr-2 h-4 w-4" />
        {label}
      </Button>

      <CommandDialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          setDynamicResults([]);
        }
      }}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search accommodation, universities, courses, bursaries, news, events..."
        />
        <CommandList className="max-h-[65vh]">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching ResKonnect...
            </div>
          )}

          {!loading && query.trim().length >= 2 && dynamicResults.length === 0 && staticMatches.length === 0 && (
            <CommandEmpty>No matching ResKonnect content found.</CommandEmpty>
          )}

          {staticMatches.length > 0 && (
            <CommandGroup heading={query.trim() ? "Pages & services" : "Quick access"}>
              {staticMatches.map((result) => {
                const Icon = result.icon;
                return (
                  <CommandItem
                    key={result.id}
                    value={`${result.label} ${result.description} ${(result.keywords ?? []).join(" ")}`}
                    onSelect={() => choose(result)}
                    className="cursor-pointer gap-3 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{result.label}</span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">{result.category}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{result.description}</p>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {dynamicResults.length > 0 && (
            <>
              {staticMatches.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Live results">
                {dynamicResults.map((result) => {
                  const Icon = result.icon;
                  return (
                    <CommandItem
                      key={result.id}
                      value={`${result.label} ${result.description} ${result.category}`}
                      onSelect={() => choose(result)}
                      className="cursor-pointer gap-3 py-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{result.label}</span>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{result.category}</Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{result.description}</p>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default PublicQuickSearch;
