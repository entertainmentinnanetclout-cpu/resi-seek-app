import { useEffect, useState } from "react";
import { MapPinned, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getCampusOptions } from "@/constants/institutionOptions";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import ResMapExperience from "@/components/resmap/ResMapExperience";

interface SmartSearchBarProps {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resultCount: number;
  totalCount: number;
}

export function SmartSearchBar({ filters, updateFilter, resultCount, totalCount }: SmartSearchBarProps) {
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "map") setMapOpen(true);
  }, []);

  const openMap = () => {
    setMapOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "map");
    window.history.replaceState({}, "", url);
  };

  const closeMap = () => {
    setMapOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  };

  const resetMapFilters = () => {
    updateFilter("searchQuery", ""); updateFilter("campus", "all"); updateFilter("category", "all"); updateFilter("gender", "all");
    updateFilter("audience", "all"); updateFilter("institutionTag", undefined); updateFilter("priceMin", 0); updateFilter("priceMax", 10000);
    updateFilter("distanceMax", 20); updateFilter("roomTypes", []); updateFilter("sectionCategory", "all"); updateFilter("nsfasOnly", false);
    updateFilter("privatePayingOnly", false); updateFilter("tutOnly", false); updateFilter("singlesOnly", false); updateFilter("furnishedOnly", false);
    updateFilter("wifiOnly", false); updateFilter("parkingOnly", false); updateFilter("availability", "all"); updateFilter("amenities", []); updateFilter("sortBy", "match");
  };

  return <>
    <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-background border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-6">
          <div className="mb-3 flex justify-center"><button onClick={openMap} className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300"><MapPinned className="h-3.5 w-3.5" />NEW · Explore in 3D ResMap</button></div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Find Your Perfect Accommodation</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Smart-match verified accommodation for university, TVET college and private applicants</p>
        </div>

        <div className="bg-card/80 backdrop-blur-lg rounded-xl shadow-lg border p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" /><Input placeholder="Search by name, location, description..." className="pl-10 h-12 text-base" value={filters.searchQuery} onChange={(e) => updateFilter("searchQuery", e.target.value)} /></div>
            <Select value={filters.campus} onValueChange={(v) => updateFilter("campus", v)}><SelectTrigger className="h-12 sm:w-56"><SelectValue placeholder="Area / campus" /></SelectTrigger><SelectContent><SelectItem value="all">All Areas</SelectItem>{getCampusOptions(filters.institutionType ?? (filters.audience === "tvet" ? "tvet" : filters.audience === "university" ? "university" : undefined)).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground">Budget: R{filters.priceMin.toLocaleString()} – R{filters.priceMax.toLocaleString()}</Label><Slider min={0} max={10000} step={250} value={[filters.priceMax]} onValueChange={([val]) => updateFilter("priceMax", val)} /></div>
            <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground">Room Type</Label><Select value={filters.roomTypes[0] || "any"} onValueChange={(v) => updateFilter("roomTypes", v === "any" ? [] : [v])}><SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger><SelectContent><SelectItem value="any">Any Type</SelectItem><SelectItem value="single">Single Room</SelectItem><SelectItem value="sharing">Sharing Room</SelectItem><SelectItem value="bachelor">Bachelor</SelectItem><SelectItem value="studio">Studio</SelectItem></SelectContent></Select></div>
            <div className="flex items-end gap-3 pb-1"><div className="flex items-center gap-2"><Switch checked={filters.nsfasOnly} onCheckedChange={(v) => updateFilter("nsfasOnly", v)} /><Label className="text-sm font-medium">NSFAS Accredited</Label></div></div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{resultCount}</span> of {totalCount} residences</p>
            <div className="flex items-center gap-2"><div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Sparkles className="w-3.5 h-3.5 text-primary" />Smart-matched results</div><Button onClick={openMap} className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-white shadow-lg"><MapPinned className="mr-2 h-4 w-4" />Open 3D ResMap</Button></div>
          </div>
        </div>
      </div>
    </div>
    {mapOpen && <ResMapExperience filters={filters} updateFilter={updateFilter} resetFilters={resetMapFilters} onClose={closeMap} />}
  </>;
}
