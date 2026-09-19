import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, MapPin, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ResidencePosterDownloadButton from "@/components/findmyres/ResidencePosterDownloadButton";
import { cn } from "@/lib/utils";
import { isNativeApp } from "@/lib/accountRouting";
import { isMockResidence } from "@/hooks/useResidenceFilters";
import { distanceKm, useLiveLocation } from "@/lib/resmap/liveLocation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ResidenceSpotlightSliderProps { residences: any[]; loading?: boolean; }
const text = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z\d]+/g, " ").trim();
const hasRealImage = (r: any) => [r.cover_image_url, r.image_url, ...(Array.isArray(r.images) ? r.images : [])].some((value: unknown) => typeof value === "string" && value.trim() && !/placeholder|\.svg$/i.test(value));
const coordinates = (r: any) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude)) && Number(r.latitude) > -36 && Number(r.latitude) < -21 && Number(r.longitude) > 15 && Number(r.longitude) < 34;
function campusMatch(r: any, campus: string) {
  const needle = text(campus);
  if (!needle || needle === "all" || needle === "not yet selected") return false;
  const residence = text([r.campus, r.address, r.city, r.name].join(" "));
  return residence.includes(needle) || (needle.includes("pretoria") && residence.includes("pretoria"));
}

export function ResidenceSpotlightSlider({ residences, loading }: ResidenceSpotlightSliderProps) {
  const native = isNativeApp();
  const live = useLiveLocation();
  const { user } = useAuth();
  const [campus, setCampus] = useState<string>("");
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  useEffect(() => {
    if (!native || !user) { setCampus(""); return; }
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("campus").eq("id", user.id).maybeSingle();
        if (error) throw error;
        if (active) setCampus(String(data?.campus || user.user_metadata?.campus || ""));
      } catch { if (active) setCampus(String(user.user_metadata?.campus || "")); }
    })();
    return () => { active = false; };
  }, [native, user?.id]);

  const position = live.status === "granted" ? live.position : null;
  const items = useMemo(() => {
    if (!native) {
      const spot = residences.filter(r => r.is_spotlight === true);
      return (spot.length ? spot : residences.filter(r => r.is_featured || r.featured)).slice(0, 8);
    }
    return residences.filter(r => !isMockResidence(r) && r.is_visible !== false && r.map_hidden !== true && (r.available_spots == null || Number(r.available_spots) > 0))
      .map(r => ({ ...r, _nearKm: position && coordinates(r) ? distanceKm(position, { latitude: Number(r.latitude), longitude: Number(r.longitude) }) : null }))
      .sort((a: any, b: any) => {
        const group = (r: any) => r._nearKm != null && r._nearKm <= 15 ? 0 : campusMatch(r, campus) ? 1 : r._nearKm != null && r._nearKm <= 30 ? 2 : 3;
        const g = group(a) - group(b);
        if (g !== 0) return g;
        const photo = Number(hasRealImage(b)) - Number(hasRealImage(a));
        if (photo) return photo;
        if (a._nearKm != null && b._nearKm != null && a._nearKm !== b._nearKm) return a._nearKm - b._nearKm;
        return Number(Boolean(b.is_spotlight || b.is_featured)) - Number(Boolean(a.is_spotlight || a.is_featured));
      }).slice(0, 12);
  }, [native, residences, campus, position?.latitude, position?.longitude, live.status]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);
  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect); onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);
  useEffect(() => {
    if (!emblaApi || items.length < 2) return;
    const id = setInterval(() => emblaApi.scrollNext(), 5000);
    return () => clearInterval(id);
  }, [emblaApi, items.length]);

  if (loading) return <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"><div className="h-64 animate-pulse rounded-2xl bg-muted sm:h-80" /></div>;
  if (!items.length) return null;
  const hasNearby = native && Boolean(position || campus);
  return <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
    <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-spotlight text-white shadow-glow"><Sparkles className="h-4 w-4" /></span><div><h2 className="bg-gradient-spotlight bg-clip-text text-lg font-bold text-transparent sm:text-xl">{hasNearby ? "Suggested accommodation near you" : "Spotlight Accommodation"}</h2><p className="text-xs text-muted-foreground">{hasNearby ? "Nearby options with photos first within each distance band. Confirm availability on each listing." : "Explore available residence options"}</p></div></div></div>
    <div className="group relative"><div className="overflow-hidden rounded-2xl" ref={emblaRef}><div className="flex">{items.map(r => {
      const slug = r.slug || r.id;
      const price = Number(r.private_price || r.price) || 0;
      const preview = r.cover_image_url || r.images?.[0] || r.image_url || "/placeholder.svg";
      return <div key={r.id} className="relative min-w-0 flex-[0_0_100%]"><Link to={`/find-my-res/${slug}`} className="block"><div className="relative h-64 overflow-hidden sm:h-80 md:h-96"><img src={preview} alt={r.name} className="h-full w-full object-cover" loading="lazy" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = "/placeholder.svg"; }} /><div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" /><div className="absolute left-4 top-4 flex gap-2 pr-28"><Badge className="border-0 bg-gradient-spotlight text-white shadow-md"><Sparkles className="mr-1 h-3 w-3" />{hasNearby ? "Suggested" : "Spotlight"}</Badge>{r.is_tut_accredited && <Badge className="border-0 bg-sky text-white">TUT ✓</Badge>}{r.accepts_nsfas && <Badge className="border-0 bg-mint text-white">NSFAS</Badge>}</div><div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div className="min-w-0"><h3 className="text-2xl font-bold leading-tight drop-shadow-md sm:text-3xl">{r.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-white/90"><MapPin className="h-4 w-4 shrink-0" /><span className="line-clamp-1">{r.address || r.campus}{r._nearKm != null ? ` · ${r._nearKm.toFixed(1)} km` : ""}</span></p>{r.rating && <p className="mt-1 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber text-amber" /><span className="font-medium">{Number(r.rating).toFixed(1)}</span></p>}</div><div className="flex shrink-0 flex-col items-end gap-2">{price > 0 && <span className="inline-flex items-baseline gap-1 rounded-full bg-gradient-price px-4 py-2 text-white shadow-lg"><span className="text-xl font-bold">R{price.toLocaleString()}</span><span className="text-xs opacity-90">/mo</span></span>}<Button size="sm" className="bg-white text-foreground shadow-md hover:bg-white/90">View details</Button></div></div></div></div></Link><div className="absolute right-4 top-4 z-30"><ResidencePosterDownloadButton residence={r} compact /></div></div>;
    })}</div></div>{items.length > 1 && <><button onClick={scrollPrev} aria-label="Previous slide" className="absolute left-2 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xl"><ChevronLeft className="h-5 w-5" /></button><button onClick={scrollNext} aria-label="Next slide" className="absolute right-2 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-xl"><ChevronRight className="h-5 w-5" /></button><div className="absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 gap-1.5">{scrollSnaps.map((_, i) => <button key={i} onClick={() => scrollTo(i)} aria-label={`Go to slide ${i + 1}`} className={cn("h-1.5 rounded-full transition", selectedIndex === i ? "w-8 bg-white" : "w-1.5 bg-white/60")} />)}</div></>}</div>
  </section>;
}

export default ResidenceSpotlightSlider;
