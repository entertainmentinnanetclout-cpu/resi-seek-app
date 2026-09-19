import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeProfile } from "@/hooks/useRealtimeProfile";
import { useLiveLocation, distanceKm } from "@/lib/resmap/liveLocation";
import { isMockResidence } from "@/hooks/useResidenceFilters";
import { residenceMatchesCampus } from "@/constants/institutionOptions";

const hasPhoto = (residence: any) => [residence.cover_image_url, ...(Array.isArray(residence.images) ? residence.images : []), residence.image_url]
  .some(image => typeof image === "string" && /^https?:\/\//i.test(image.trim()) && !/placeholder|default-image|no-image/i.test(image));
const photo = (residence: any) => [residence.cover_image_url, ...(Array.isArray(residence.images) ? residence.images : []), residence.image_url]
  .find(image => typeof image === "string" && /^https?:\/\//i.test(image.trim()) && !/placeholder|default-image|no-image/i.test(image)) || null;
const coordinate = (r: any) => {
  const lat = Number(r.latitude), lon = Number(r.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -35.5 && lat <= -21 && lon >= 15 && lon <= 34 ? { latitude: lat, longitude: lon } : null;
};

export default function NearbySuggestedResidences({ residences }: { residences: any[] }) {
  const { user } = useAuth();
  const { profile } = useRealtimeProfile(user);
  const live = useLiveLocation();
  const campus = String(profile?.campus || "").trim();
  const position = live.status === "granted" && live.position ? live.position : null;
  const items = useMemo(() => {
    if (!campus && !position) return [];
    return residences.filter(r => !isMockResidence(r) && r.is_visible !== false && r.is_active !== false)
      .map(r => {
        const pin = coordinate(r);
        const km = position && pin ? distanceKm(position, pin) : null;
        const campusMatch = campus ? residenceMatchesCampus(r, campus) : false;
        // GPS within 15 km or a matching student campus is locally relevant;
        // photos never move an unrelated city above a nearby listing.
        const locality = km !== null && km <= 15 ? 0 : campusMatch ? 1 : 2;
        return { ...r, _nearbyKm: km, _locality: locality, _hasRealPhoto: hasPhoto(r) };
      })
      .filter(r => r._locality < 2)
      .sort((a, b) => a._locality - b._locality
        || Number(b._hasRealPhoto) - Number(a._hasRealPhoto)
        || (a._nearbyKm ?? Number(a.distance_from_campus) ?? 999) - (b._nearbyKm ?? Number(b.distance_from_campus) ?? 999)
        || String(a.name).localeCompare(String(b.name)))
      .slice(0, 8);
  }, [residences, campus, position?.latitude, position?.longitude]);
  if (!items.length) return null;
  return <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8" aria-label="Suggested accommodation near you">
    <div className="mb-3 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Navigation className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-foreground">Suggested accommodation near you</h2><p className="text-xs text-muted-foreground">{campus ? `Near ${campus}` : "Near your current location"} · Residences with photos appear first within nearby matches</p></div></div>
    <div className="flex snap-x gap-3 overflow-x-auto pb-3">
      {items.map(r => <Link key={r.id} to={`/find-my-res/${r.slug || r.id}`} className="group min-w-[225px] max-w-[250px] flex-[0_0_72%] snap-start overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md sm:flex-[0_0_250px]">
        <div className="relative h-36 bg-muted">{photo(r) ? <img src={photo(r)} loading="lazy" alt={r.name} className="h-full w-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Photo not available</div>}{r._nearbyKm !== null && <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-1 text-[11px] font-bold text-foreground"><MapPin className="mr-1 inline h-3 w-3" />{r._nearbyKm.toFixed(1)} km away</span>}</div>
        <div className="space-y-1 p-3"><h3 className="line-clamp-1 text-sm font-bold text-foreground">{r.name}</h3><p className="line-clamp-1 text-xs text-muted-foreground">{r.address || r.campus}</p><div className="flex items-center justify-between"><span className="text-sm font-black text-primary">{Number(r.price) > 0 ? `R${Number(r.price).toLocaleString()}/mo` : "Ask for price"}</span><span className="text-[11px] font-bold text-primary">View</span></div></div>
      </Link>)}
    </div>
  </section>;
}
