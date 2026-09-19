import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Rotate3D, LocateFixed, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import { isMockResidence } from "@/hooks/useResidenceFilters";
import { useRealtimeResidences } from "@/hooks/useRealtimeResidences";
import { distanceKm, requestLiveLocation, useLiveLocation } from "@/lib/resmap/liveLocation";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";

interface Props { filters: ResidenceFilters; updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void; resetFilters: () => void; onClose: () => void; }
const validCoordinates = (r: any) => Number.isFinite(Number(r?.latitude)) && Number.isFinite(Number(r?.longitude)) && Number(r.latitude) > -36 && Number(r.latitude) < -21 && Number(r.longitude) > 15 && Number(r.longitude) < 34;
const hasPhoto = (r: any) => [r.cover_image_url, r.image_url, ...(Array.isArray(r.images) ? r.images : [])].some((src: unknown) => typeof src === "string" && /^https?:\/\//i.test(src));
const normalized = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z\d]+/g, " ").trim();
const relevantCampus = (r: any, campus: string) => {
  const needle = normalized(campus);
  if (!needle || needle === "all" || needle === "not yet selected") return true;
  const hay = normalized([r.campus, r.address, r.name, r.city].join(" "));
  if (hay.includes(needle)) return true;
  // A residence located in Pretoria can still be relevant to a Pretoria West student.
  return needle.includes("pretoria") && hay.includes("pretoria");
};

/** Non-WebGL native map fallback: a 3D GPU/process crash must not terminate the signed-in application. */
export default function ResMapNativeSafe({ filters, updateFilter, onClose }: Props) {
  const { residences, loading } = useRealtimeResidences();
  const live = useLiveLocation();
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [view3dInfo, setView3dInfo] = useState(false);
  const focus = live.status === "granted" && live.position ? live.position : null;
  const campus = filters.campus !== "all" ? filters.campus : String(profile?.campus || "");
  const nearby = useMemo(() => residences.filter((r: any) => !isMockResidence(r) && r.is_visible !== false && r.map_hidden !== true && (!filters.category || filters.category === "all" || r.category === filters.category) && relevantCampus(r, campus)).map((r: any) => ({ ...r, _km: focus && validCoordinates(r) ? distanceKm(focus, { latitude: Number(r.latitude), longitude: Number(r.longitude) }) : null })).sort((a: any, b: any) => {
    const ad = a._km as number | null; const bd = b._km as number | null;
    const aNear = ad == null ? 100 : ad <= 5 ? 0 : ad <= 15 ? 1 : ad <= 30 ? 2 : 3;
    const bNear = bd == null ? 100 : bd <= 5 ? 0 : bd <= 15 ? 1 : bd <= 30 ? 2 : 3;
    if (aNear !== bNear) return aNear - bNear;
    if (hasPhoto(a) !== hasPhoto(b)) return hasPhoto(a) ? -1 : 1;
    return (ad ?? 100000) - (bd ?? 100000);
  }).slice(0, 40), [residences, campus, filters.category, focus?.latitude, focus?.longitude, live.status]);
  const center = focus || nearby.find((r: any) => validCoordinates(r));
  const lat = center ? Number((center as any).latitude) : null;
  const lng = center ? Number((center as any).longitude) : null;
  const bbox = lat != null && lng != null ? `${lng - .018},${lat - .013},${lng + .018},${lat + .013}` : null;
  return <section role="dialog" aria-modal="true" aria-label="ResMap native map" className="fixed inset-0 z-[240] flex flex-col overflow-hidden bg-background text-foreground">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]"><Button variant="ghost" type="button" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Find My Res</Button><strong className="text-sm">ResMap · Nearby</strong><Button size="sm" variant="outline" onClick={async () => { setGpsBusy(true); try { await requestLiveLocation(); } finally { setGpsBusy(false); } }} disabled={gpsBusy}><LocateFixed className="mr-1 h-4 w-4" />{gpsBusy ? "Locating" : "Locate"}</Button></header>
    <div className="min-h-0 flex-1 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
      {bbox ? <iframe title="Accommodation area map" loading="lazy" referrerPolicy="no-referrer" className="h-[36dvh] min-h-52 w-full border-0 bg-muted" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`} /> : <div className="grid h-48 place-items-center bg-muted px-6 text-center text-sm text-muted-foreground">Select your campus or enable device location to show a nearby map.</div>}
      <div className="space-y-3 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">Nearby accommodation</h2><p className="text-xs text-muted-foreground">Relevant nearby residences with photos are displayed first within each distance band. Availability must be confirmed on each listing.</p></div><Button size="sm" variant="outline" onClick={() => setView3dInfo(value => !value)}><Rotate3D className="mr-2 h-4 w-4" />3D</Button></div>
      {view3dInfo && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This device is using the stable 2D map because the experimental 3D renderer may terminate the Android app. Continue browsing here while native 3D compatibility is verified.</div>}
      {!campus && !focus && <p className="rounded-xl border bg-muted p-3 text-sm">For closer recommendations, select a campus in Find My Res or enable your location.</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading real residences…</p> : nearby.length ? <div className="grid gap-3 sm:grid-cols-2">{nearby.map((r: any) => { const image = r.cover_image_url || r.image_url || r.images?.[0]; return <Link key={r.id} to={`/find-my-res/${r.slug || r.id}`} onClick={onClose} className="flex min-w-0 gap-3 overflow-hidden rounded-2xl border bg-card p-2 shadow-sm">{hasPhoto(r) ? <img src={image} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-lg object-cover" /> : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-lg bg-muted"><MapPin className="h-5 w-5" /></div>}<div className="min-w-0 py-1"><p className="line-clamp-2 font-bold">{r.name}</p><p className="mt-1 text-xs text-muted-foreground">{r.address || r.campus}{r._km != null ? ` · ${r._km.toFixed(1)} km` : ""}</p><p className="mt-1 text-xs font-semibold">{r.available_spots == null ? "Check availability" : Number(r.available_spots) > 0 ? `${r.available_spots} spots reported` : "No spots reported"}</p></div></Link>; })}</div> : <p className="rounded-xl border p-4 text-sm text-muted-foreground">No matching residences in this area. Change your campus or filters to widen your search.</p>}
      <Button variant="outline" onClick={() => { onClose(); document.querySelector("#results")?.scrollIntoView({ behavior: "smooth" }); }}><Search className="mr-2 h-4 w-4" />Browse all results</Button></div>
    </div>
  </section>;
}
