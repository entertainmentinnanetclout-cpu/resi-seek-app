import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BedDouble, Bike, Building2, Bus, Car, CheckCircle2, Clock3, ExternalLink, Footprints, MapPin, Route, ShieldCheck, Sparkles, View, Wifi, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TravelMode } from "@/lib/resmap/spatial";

interface NearbyPlace { name: string; kind: string; distanceKm?: number; }
interface RouteInfo { distance_m: number; duration_s: number; provider: string; profile: TravelMode; }

interface Props {
  residence: any;
  routeInfo?: RouteInfo | null;
  nearby?: NearbyPlace[];
  travelMode: TravelMode;
  onRoute: () => void;
  onClose: () => void;
}

const money = (value: unknown) => Number(value) > 0 ? `R${Number(value).toLocaleString("en-ZA")}` : "Ask residence";
const iconForMode = (mode: TravelMode) => mode === "walk" ? Footprints : mode === "bike" ? Bike : mode === "transport" ? Bus : Car;

export default function ResMapResidenceCard({ residence, routeInfo, nearby = [], travelMode, onRoute, onClose }: Props) {
  const navigate = useNavigate();
  const image = residence.cover_image_url || residence.image_url || (Array.isArray(residence.images) ? residence.images[0] : null);
  const slug = residence.slug || residence.id;
  const spots = Number(residence.available_spots || 0);
  const price = residence.accepts_nsfas && residence.nsfas_price ? residence.nsfas_price : residence.private_price || residence.price;
  const ModeIcon = iconForMode(travelMode);
  const roomTypes = useMemo(() => Array.from(new Set([...(residence.room_types || []), residence.room_type].filter(Boolean))) as string[], [residence]);
  const approximate = residence.location_verification_status === "approximate" || residence.geocode_source === "campus_area_approximation";

  return (
    <section className="pointer-events-auto w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 sm:max-w-[430px]">
      <div className="relative h-40 bg-gradient-to-br from-[#061a33] via-[#0b3d70] to-[#0e91a8]">
        {image ? <img src={image} alt={residence.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Building2 className="h-16 w-16 text-white/50" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <button onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur" aria-label="Close residence card"><X className="h-4 w-4" /></button>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">{approximate ? <Badge className="border border-amber-300 bg-amber-500/90 text-white">Approximate area pin</Badge> : <Badge className="border border-emerald-300 bg-emerald-600/90 text-white">Mapped location</Badge>}</div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0"><p className="truncate text-lg font-black">{residence.name}</p><p className="flex items-center gap-1 truncate text-xs text-white/85"><MapPin className="h-3.5 w-3.5" />{residence.canonical_address || residence.place_label || residence.address || residence.campus}</p></div>
          <span className="shrink-0 rounded-full bg-white/95 px-3 py-1 text-sm font-black text-slate-950">{money(price)}/mo</span>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {residence.accepts_nsfas && <Badge className="bg-emerald-600 text-white">NSFAS</Badge>}
          {residence.is_tut_accredited && <Badge className="bg-blue-600 text-white">TUT verified</Badge>}
          {residence.has_wifi && <Badge variant="outline"><Wifi className="mr-1 h-3 w-3" />Wi-Fi</Badge>}
          {roomTypes.slice(0, 2).map((room) => <Badge key={room} variant="outline"><BedDouble className="mr-1 h-3 w-3" />{room}</Badge>)}
          <Badge variant="outline" className={spots > 5 ? "border-emerald-300 text-emerald-700" : spots > 0 ? "border-amber-300 text-amber-700" : "border-slate-300"}>{spots > 0 ? `${spots} spaces` : "Check availability"}</Badge>
        </div>

        {approximate && <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">This residence is included on ResMap, but its pin is an area-level fallback while the exact street position is being verified. Do not use this pin as the final entrance location.</div>}
        {routeInfo && !approximate && <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-slate-50 p-3 text-sm dark:bg-slate-900"><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Travel time</p><p className="mt-1 flex items-center gap-1 font-bold"><ModeIcon className="h-4 w-4" />{Math.max(1, Math.round(routeInfo.duration_s / 60))} min</p></div><div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Route distance</p><p className="mt-1 font-bold">{(routeInfo.distance_m / 1000).toFixed(1)} km</p></div></div>}

        {nearby.length > 0 && <div><div className="mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Nearby on the live map</p></div><div className="flex gap-2 overflow-x-auto pb-1">{nearby.slice(0, 6).map((place) => <div key={`${place.name}-${place.kind}`} className="min-w-[140px] rounded-xl border bg-background p-2"><p className="truncate text-xs font-semibold">{place.name}</p><p className="mt-0.5 text-[10px] capitalize text-muted-foreground">{place.kind}{place.distanceKm != null ? ` · ${place.distanceKm.toFixed(1)} km` : ""}</p></div>)}</div></div>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={approximate} onClick={onRoute}><Route className="mr-2 h-4 w-4" />{approximate ? "Route pending" : "Route here"}</Button>
          <Button onClick={() => navigate(`/find-my-res/${slug}?intent=secure`)}><CheckCircle2 className="mr-2 h-4 w-4" />View & secure</Button>
        </div>
        <Button className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white" onClick={() => navigate(`/find-my-res/${slug}/immersive`)}><View className="mr-2 h-4 w-4" />Open Immersive Living</Button>
        <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => navigate(`/find-my-res/${slug}`)}><ShieldCheck className="mr-2 h-4 w-4" />Full details</Button>{residence.google_maps_url ? <Button variant="outline" asChild><a href={residence.google_maps_url} target="_blank" rel="noreferrer"><MapPin className="mr-2 h-4 w-4" />Google Maps<ExternalLink className="ml-1 h-3 w-3" /></a></Button> : <Button variant="outline" disabled>Map check</Button>}</div>
        {routeInfo?.provider === "geodesic-fallback" && !approximate && <p className="text-[10px] leading-relaxed text-muted-foreground"><Clock3 className="mr-1 inline h-3 w-3" />Road routing was temporarily unavailable, so this journey is an estimate. The residence location remains mapped from stored coordinates.</p>}
      </div>
    </section>
  );
}
