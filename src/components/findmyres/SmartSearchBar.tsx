import { lazy, Suspense, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, MapPinned, Search, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getCampusOptions } from "@/constants/institutionOptions";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import { FindMyResLocationPrompt } from "@/components/findmyres/FindMyResLocationPrompt";

const ResMapExperience = lazy(() => import("@/components/resmap/ResMapPlatform"));
const ResDiscoveryEngine = lazy(() => import("@/components/resmap/ResDiscoveryEngine"));

interface SmartSearchBarProps {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resultCount: number;
  totalCount: number;
  cityOptions: string[];
}

/** All finder overlays are URL-driven. An in-page link from a match can open its map without remounting FindMyRes. */
export function SmartSearchBar({ filters, updateFilter, resultCount, totalCount,cityOptions }: SmartSearchBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const mapOpen = query.get("view") === "map";
  const discoveryOpen = !mapOpen && query.has("discovery");
  const navigateOverlay = (mode: "map" | "discovery" | "close") => {
    const params = new URLSearchParams(location.search);
    params.delete("view"); params.delete("mode"); params.delete("discovery"); params.delete("group");
    if (mode === "map") params.set("view", "map");
    if (mode === "discovery") params.set("discovery", "discover");
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params}` : "" }, { replace: true, preventScrollReset: true });
  };

  const resetMapFilters = () => {
    updateFilter("searchQuery", ""); updateFilter("city","all"); updateFilter("campus", "all"); updateFilter("category", "all"); updateFilter("gender", "all");
    updateFilter("audience", "all"); updateFilter("institutionTag", undefined); updateFilter("priceMin", 0); updateFilter("priceMax", 10000);
    updateFilter("distanceMax", 20); updateFilter("roomTypes", []); updateFilter("sectionCategory", "all"); updateFilter("nsfasOnly", false);
    updateFilter("privatePayingOnly", false); updateFilter("tutOnly", false); updateFilter("singlesOnly", false);updateFilter("photoOnly",false);updateFilter("priceVerifiedOnly",false); updateFilter("furnishedOnly", false);
    updateFilter("wifiOnly", false); updateFilter("parkingOnly", false); updateFilter("availability", "all"); updateFilter("amenities", []); updateFilter("sortBy", "match");
  };

  return <>
    <FindMyResLocationPrompt />
    <div className="relative isolate overflow-hidden border-b border-[#163d6f] bg-[linear-gradient(125deg,#081b37_0%,#113b70_62%,#091a35_100%)] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-48 h-96 w-96 rounded-full bg-blue-400/15 blur-[85px]"/>
      <div className="relative mx-auto max-w-7xl px-4 py-9 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-6 text-center">
          <div className="mb-3 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#f7d28c]/40 bg-[#f7d28c]/15 px-3.5 py-1.5 text-xs font-black text-[#ffdfa4]"><Building2 className="h-3.5 w-3.5" />ResKonnect Living</span>
            <button type="button" onClick={() => navigateOverlay("discovery")} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/20"><WandSparkles className="h-3.5 w-3.5" />Smart matching</button>
            <button type="button" onClick={() => navigateOverlay("map")} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black text-white transition hover:bg-white/20"><MapPinned className="h-3.5 w-3.5" />Map & 3D tools</button>
          </div>
          <h1 className="mb-2 text-4xl font-black tracking-tight text-white sm:text-5xl">Find your next home. <span className="text-[#ffd792]">Without the guesswork.</span></h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-white/80 sm:text-base">Search accommodation by campus, area, budget, funding and room type. Discover priority residence showcases, then compare genuine listings using smart matching and ResMap.</p>
        </div>
        <div className="space-y-4 rounded-[24px] border border-white/30 bg-card p-4 text-foreground shadow-[0_25px_70px_rgba(2,10,27,.32)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by residence, city, neighbourhood or campus…" className="h-12 pl-10 text-base" value={filters.searchQuery} onChange={(e) => updateFilter("searchQuery", e.target.value)} /></div>
            <Select value={filters.city} onValueChange={v=>updateFilter("city",v)}><SelectTrigger className="h-12 sm:w-48" aria-label="Filter by city"><SelectValue placeholder="All cities"/></SelectTrigger><SelectContent><SelectItem value="all">All cities</SelectItem>{cityOptions.map(city=><SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select>
            <Select value={filters.campus} onValueChange={(v) => updateFilter("campus", v)}><SelectTrigger className="h-12 sm:w-56"><SelectValue placeholder="Area / campus" /></SelectTrigger><SelectContent><SelectItem value="all">All Areas</SelectItem>{getCampusOptions(filters.institutionType ?? (filters.audience === "tvet" ? "tvet" : filters.audience === "university" ? "university" : undefined)).map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground">Budget: R{filters.priceMin.toLocaleString()} – R{filters.priceMax.toLocaleString()}</Label><Slider min={0} max={10000} step={250} value={[filters.priceMax]} onValueChange={([val]) => updateFilter("priceMax", val)} /></div>
            <div className="space-y-2"><Label className="text-xs font-medium text-muted-foreground">Room Type</Label><Select value={filters.roomTypes[0] || "any"} onValueChange={(v) => updateFilter("roomTypes", v === "any" ? [] : [v])}><SelectTrigger><SelectValue placeholder="Any type" /></SelectTrigger><SelectContent><SelectItem value="any">Any Type</SelectItem><SelectItem value="single">Single Room</SelectItem><SelectItem value="sharing">Sharing Room</SelectItem><SelectItem value="bachelor">Bachelor</SelectItem><SelectItem value="studio">Studio</SelectItem></SelectContent></Select></div>
            <div className="flex items-end gap-3 pb-1"><div className="flex items-center gap-2"><Switch checked={filters.nsfasOnly} onCheckedChange={(v) => updateFilter("nsfasOnly", v)} /><Label className="text-sm font-medium">NSFAS funding context</Label></div></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
            <label className="flex items-center gap-2"><Switch checked={filters.availability==="available"} onCheckedChange={v=>updateFilter("availability",v?"available":"all")} /><span>Available beds only</span></label>
            <label className="flex items-center gap-2"><Switch checked={filters.photoOnly} onCheckedChange={v=>updateFilter("photoOnly",v)} /><span>Listings with real photos</span></label>
            <label className="flex items-center gap-2"><Switch checked={filters.priceVerifiedOnly} onCheckedChange={v=>updateFilter("priceVerifiedOnly",v)} /><span>Verified price only</span></label>
            <span className="text-muted-foreground">Unverified availability remains landlord-reported, not a guaranteed booking.</span>
          </div>
          {cityOptions.length>0&&<div className="flex flex-wrap gap-2">{cityOptions.slice(0,7).map(city=><Button key={city} type="button" size="sm" variant={filters.city===city?"default":"outline"} className="rounded-full" onClick={()=>updateFilter("city",filters.city===city?"all":city)}>{city}</Button>)}</div>}
          {filters.nsfasOnly && <p className="text-xs leading-5 text-muted-foreground">This filter uses funding/accreditation context in listing data. It does not by itself prove current official accreditation; verify the status shown on the residence or NSFAS status page.</p>}
          <div className="flex flex-col gap-3 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{resultCount}</span> of {totalCount} residences{resultCount === 0 && totalCount > 0 ? " · Try another campus or clear filters" : ""}</p>
            <div className="grid grid-cols-2 gap-2 sm:flex"><Button type="button" onClick={() => navigateOverlay("discovery")} variant="outline" className="h-10 rounded-full px-4"><Sparkles className="mr-2 h-4 w-4 text-violet-500" />Smart Finder</Button><Button type="button" onClick={() => navigateOverlay("map")} className="h-10 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-5 text-white shadow-lg"><MapPinned className="mr-2 h-4 w-4" />Map & 3D</Button></div>
          </div>
        </div>
      </div>
    </div>
    <Suspense fallback={<div role="status" className="fixed inset-0 z-[240] grid place-items-center bg-slate-950 text-sm font-semibold text-white">Opening ResKonnect Finder…</div>}>
      {mapOpen && <ResMapExperience filters={filters} updateFilter={updateFilter} resetFilters={resetMapFilters} onClose={() => navigateOverlay("close")} />}
      {discoveryOpen && <ResDiscoveryEngine filters={filters} onClose={() => navigateOverlay("close")} />}
    </Suspense>
  </>;
}
