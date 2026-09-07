import { useEffect, useState } from "react";
import { MapPinned, Search, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getCampusOptions } from "@/constants/institutionOptions";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import ResMapExperience from "@/components/resmap/ResMapExperience";
import ResDiscoveryEngine from "@/components/resmap/ResDiscoveryEngine";

interface SmartSearchBarProps {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resultCount: number;
  totalCount: number;
}

export function SmartSearchBar({ filters, updateFilter, resultCount, totalCount }: SmartSearchBarProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "map") setMapOpen(true);
    if (params.has("discovery")) setDiscoveryOpen(true);
  }, []);

  const openMap = () => {
    setDiscoveryOpen(false);
    setMapOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.set("view", "map");
    url.searchParams.delete("discovery");
    window.history.replaceState({}, "", url);
  };

  const closeMap = () => {
    setMapOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState({}, "", url);
  };

  const openDiscovery = () => {
    setMapOpen(false);
    setDiscoveryOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.set("discovery", "discover");
    window.history.replaceState({}, "", url);
  };

  const closeDiscovery = () => {
    setDiscoveryOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("discovery");
    url.searchParams.delete("group");
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
    <div className="border-b bg-gradient-to-br from-primary/10 via-accent/5 to-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6 text-center">
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            <button onClick={openMap} className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-500/15 dark:text-blue-300"><MapPinned className="h-3.5 w-3.5" />3D ResMap</button>
            <button onClick={openDiscovery} className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-black text-violet-700 transition hover:bg-violet-500/15 dark:text-violet-300"><WandSparkles className="h-3.5 w-3.5" />NEW · Discovery Engine</button>
          </div>
          <h1 className="mb-2 text-3xl font-bold sm:text-4xl">Find Your Perfect Accommodation</h1>
          <p className="text-sm text-muted-foreground sm:text-base">Search traditionally, explore the city in 3D, or let Dimpho rank every residence around your Res DNA.</p>
        </div>

        <div className="space-y-4 rounded-xl border bg-card/80 p-4 shadow-lg backdrop-blur-lg sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by name, location, description..." className="h-12 pl-10 text-base" value={filters.searchQuery} onChange={(e) => updateFilter("searchQuery", e.target.value)} /></div>
            <Select value={filters.campus} onValueChange={(v) => updateFilter("campus", v)}><SelectTrigger className="h-12 sm:w-56"><SelectValue placeholder="Area / campus" /></SelectTrigger><SelectContent><SelectItem value="all">All Areas</SelectItem>{getCampusOptions(filters.institutionType ?? (filters.audience === "tvet" ? "tvet" : filters.audience === "university" ? "university" : undefined)).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground">Budget: R{filters.priceMin.toLocaleString()} – R{filters.priceMax.toLocaleString()}</Label><Slider min={0} max={10000} step={250} value={[filters.priceMax]} onValueChange={([val]) => updateFilter("priceMax", val)} /></div>
            <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground">Room Type</Label><Select value={filters.roomTypes[0] || "any"} onValueChange={(v) => updateFilter("roomTypes", v === "any" ? [] : [v])}><SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger><SelectContent><SelectItem value="any">Any Type</SelectItem><SelectItem value="single">Single Room</SelectItem><SelectItem value="sharing">Sharing Room</SelectItem><SelectItem value="bachelor">Bachelor</SelectItem><SelectItem value="studio">Studio</SelectItem></SelectContent></Select></div>
            <div className="flex items-end gap-3 pb-1"><div className="flex items-center gap-2"><Switch checked={filters.nsfasOnly} onCheckedChange={(v) => updateFilter("nsfasOnly", v)} /><Label className="text-sm font-medium">NSFAS Accredited</Label></div></div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{resultCount}</span> of {totalCount} residences</p>
            <div className="grid grid-cols-2 gap-2 sm:flex"><Button onClick={openDiscovery} variant="outline" className="h-10 rounded-full px-4"><Sparkles className="mr-2 h-4 w-4 text-violet-500" />Discover</Button><Button onClick={openMap} className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-white shadow-lg"><MapPinned className="mr-2 h-4 w-4" />Open 3D ResMap</Button></div>
          </div>
        </div>
      </div>
    </div>
    {mapOpen && <ResMapExperience filters={filters} updateFilter={updateFilter} resetFilters={resetMapFilters} onClose={closeMap} />}
    {discoveryOpen && <ResDiscoveryEngine filters={filters} onClose={closeDiscovery} />}
  </>;
}
