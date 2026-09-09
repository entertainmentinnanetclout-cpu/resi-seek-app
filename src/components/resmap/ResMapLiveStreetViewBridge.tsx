import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, LocateFixed, Navigation, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requestLiveLocation, useLiveLocation, distanceKm } from "@/lib/resmap/liveLocation";
import { toast } from "sonner";

const NAV_LOCAL_KEY = "reskonnect_resmap_active_navigation_v4";
const MAX_ROUTE_AGE_MS = 6 * 60 * 60 * 1000;

type Center = { latitude: number; longitude: number };
type RouteSnapshot = {
  residence_id?: string;
  route?: {
    geometry?: { coordinates?: number[][] };
    distance_m?: number;
    duration_s?: number;
  };
  progress_m?: number;
  step_index?: number;
  updated_at?: string;
  started_at?: string;
};

type MapConfig = {
  google_maps_enabled?: boolean;
  google_maps_browser_key?: string | null;
};

let googleLoader: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (googleLoader) return googleLoader;

  googleLoader = new Promise((resolve, reject) => {
    const id = "resmap-google-maps-js";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    const finish = () => w.google?.maps?.importLibrary
      ? resolve(w.google)
      : reject(new Error("Google Maps did not initialize"));

    if (existing) {
      if (w.google?.maps?.importLibrary) return finish();
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.onload = finish;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    googleLoader = null;
    throw error;
  });

  return googleLoader;
}

function bearingBetween(a: Center, b: Center) {
  const toRad = (value: number) => value * Math.PI / 180;
  const toDeg = (value: number) => value * 180 / Math.PI;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function projectToSegment(point: Center, a: Center, b: Center) {
  const lat0 = point.latitude * Math.PI / 180;
  const mPerDegLat = 111132;
  const mPerDegLng = Math.max(1, 111320 * Math.cos(lat0));
  const ax = (a.longitude - point.longitude) * mPerDegLng;
  const ay = (a.latitude - point.latitude) * mPerDegLat;
  const bx = (b.longitude - point.longitude) * mPerDegLng;
  const by = (b.latitude - point.latitude) * mPerDegLat;
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, -((ax * vx + ay * vy) / len2))) : 0;
  const px = ax + vx * t;
  const py = ay + vy * t;
  return {
    t,
    distanceM: Math.hypot(px, py),
    point: {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    },
  };
}

function nearestRoutePoint(position: Center, coords: number[][]) {
  let best: { point: Center; heading: number; distanceM: number } | null = null;
  for (let index = 0; index < coords.length - 1; index += 1) {
    const a = { latitude: Number(coords[index]?.[1]), longitude: Number(coords[index]?.[0]) };
    const b = { latitude: Number(coords[index + 1]?.[1]), longitude: Number(coords[index + 1]?.[0]) };
    if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite)) continue;
    const projected = projectToSegment(position, a, b);
    const candidate = {
      point: projected.point,
      heading: bearingBetween(a, b),
      distanceM: projected.distanceM,
    };
    if (!best || candidate.distanceM < best.distanceM) best = candidate;
  }
  return best;
}

function readSnapshot(): RouteSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(NAV_LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RouteSnapshot;
    const updated = Date.parse(parsed.updated_at || parsed.started_at || "");
    const coords = parsed.route?.geometry?.coordinates;
    if (!Number.isFinite(updated) || Date.now() - updated > MAX_ROUTE_AGE_MS || !Array.isArray(coords) || coords.length < 2) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function ResMapLiveStreetViewBridge() {
  const live = useLiveLocation();
  const panoramaNodeRef = useRef<HTMLDivElement | null>(null);
  const panoramaRef = useRef<any>(null);
  const serviceRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const lastResolvedPointRef = useRef<Center | null>(null);
  const lastResolvedAtRef = useRef(0);

  const [snapshot, setSnapshot] = useState<RouteSnapshot | null>(() => readSnapshot());
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setSnapshot(readSnapshot());
    update();
    const timer = window.setInterval(update, 750);
    window.addEventListener("storage", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", update);
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (supabase as any).from("resmap_map_config")
      .select("google_maps_enabled,google_maps_browser_key")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }: any) => { if (active) setConfig(data || null); });
    return () => { active = false; };
  }, []);

  const coords = useMemo(() => snapshot?.route?.geometry?.coordinates || [], [snapshot]);
  const routeIsActive = Boolean(snapshot && coords.length >= 2);
  const googleConfigured = Boolean(config?.google_maps_enabled && config?.google_maps_browser_key);

  const resolvePanorama = useCallback(async (force = false) => {
    if (!open || !panoramaNodeRef.current || !config?.google_maps_browser_key || coords.length < 2) return;

    let current = live.position
      ? { latitude: live.position.latitude, longitude: live.position.longitude }
      : null;

    if (!current) {
      const granted = await requestLiveLocation();
      if (!granted) throw new Error("Live location permission is required for route Street View");
      if (live.position) current = { latitude: live.position.latitude, longitude: live.position.longitude };
    }
    if (!current) throw new Error("Waiting for a live GPS position");

    const route = nearestRoutePoint(current, coords);
    const routePoint = route?.point || current;
    const heading = route?.heading ?? 0;
    const last = lastResolvedPointRef.current;
    const movedM = last ? distanceKm(last, routePoint) * 1000 : Number.POSITIVE_INFINITY;
    const due = Date.now() - lastResolvedAtRef.current > 4000;
    if (!force && panoramaRef.current && movedM < 9 && !due) return;

    setStatus("loading");
    setMessage(null);
    const google = await loadGoogleMaps(config.google_maps_browser_key);
    const streetLibrary = await google.maps.importLibrary("streetView");
    if (!serviceRef.current) serviceRef.current = new streetLibrary.StreetViewService();

    const candidates = [
      { point: routePoint, radius: 75, source: google.maps.StreetViewSource.OUTDOOR },
      { point: current, radius: 100, source: google.maps.StreetViewSource.OUTDOOR },
      { point: routePoint, radius: 180, source: google.maps.StreetViewSource.DEFAULT },
    ];

    let response: any = null;
    for (const candidate of candidates) {
      try {
        response = await serviceRef.current.getPanorama({
          location: { lat: candidate.point.latitude, lng: candidate.point.longitude },
          radius: candidate.radius,
          preference: google.maps.StreetViewPreference.NEAREST,
          source: candidate.source,
        });
        if (response?.data?.location?.pano) break;
      } catch {
        response = null;
      }
    }

    const panoId = response?.data?.location?.pano;
    if (!panoId) throw new Error("No Google Street View coverage was found close to this route segment");

    if (!panoramaRef.current) {
      panoramaRef.current = new streetLibrary.StreetViewPanorama(panoramaNodeRef.current, {
        pano: panoId,
        pov: { heading, pitch: 0 },
        zoom: 1,
        addressControl: true,
        fullscreenControl: true,
        linksControl: true,
        motionTracking: true,
        motionTrackingControl: true,
        panControl: true,
        zoomControl: true,
        enableCloseButton: false,
        clickToGo: true,
        visible: true,
      });
    } else {
      panoramaRef.current.setVisible(true);
      panoramaRef.current.setPano(panoId);
      panoramaRef.current.setPov({ heading, pitch: 0 });
    }

    const destinationCoord = coords[coords.length - 1];
    if (Array.isArray(destinationCoord) && Number.isFinite(Number(destinationCoord[0])) && Number.isFinite(Number(destinationCoord[1]))) {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new google.maps.Marker({
          map: panoramaRef.current,
          position: { lat: Number(destinationCoord[1]), lng: Number(destinationCoord[0]) },
          title: "Route destination",
        });
      } else {
        destinationMarkerRef.current.setMap(panoramaRef.current);
        destinationMarkerRef.current.setPosition({ lat: Number(destinationCoord[1]), lng: Number(destinationCoord[0]) });
      }
    }

    lastResolvedPointRef.current = routePoint;
    lastResolvedAtRef.current = Date.now();
    setStatus("ready");
  }, [config?.google_maps_browser_key, coords, live.position, open]);

  useEffect(() => {
    if (!open) return;
    void resolvePanorama(false).catch((error) => {
      console.warn("[ResMapLiveStreetView] panorama unavailable", error);
      setStatus("unavailable");
      setMessage(error instanceof Error ? error.message : "Street View is unavailable here");
    });
  }, [live.position?.latitude, live.position?.longitude, open, resolvePanorama]);

  useEffect(() => {
    if (routeIsActive) return;
    if (open) setOpen(false);
    panoramaRef.current?.setVisible?.(false);
    destinationMarkerRef.current?.setMap?.(null);
  }, [open, routeIsActive]);

  const launch = async () => {
    if (!googleConfigured) {
      toast.error("Google Street View is not configured for ResMap.");
      return;
    }
    const ok = live.status === "granted" || await requestLiveLocation();
    if (!ok && !live.position) {
      toast.error("Enable Location to use live route Street View.");
      return;
    }
    setStatus("loading");
    setOpen(true);
  };

  if (!routeIsActive) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => void launch()}
          disabled={!googleConfigured}
          className="fixed left-3 top-[calc(104px+env(safe-area-inset-top))] z-[245] inline-flex h-12 items-center gap-2 rounded-full border border-white/90 bg-slate-950 px-4 text-sm font-black text-white shadow-2xl disabled:cursor-not-allowed disabled:opacity-50 sm:left-5"
          aria-label="Open live 360 Street View for this route"
          title="Live 360 Google Street View"
        >
          <Eye className="h-5 w-5 text-cyan-300" />
          <span>LIVE 360</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[275] overflow-hidden bg-slate-950 text-white">
          <div ref={panoramaNodeRef} className="absolute inset-0 bg-slate-900" />

          <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pt-[calc(10px+env(safe-area-inset-top))] sm:px-5">
            <div className="pointer-events-auto rounded-[22px] border border-white/20 bg-slate-950/80 px-4 py-3 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-cyan-300" />
                <p className="font-black">Live 360 Street View</p>
                <Badge className="bg-cyan-500 text-slate-950">GOOGLE</Badge>
              </div>
              <p className="mt-1 max-w-[72vw] text-[11px] text-white/70">Real Street View imagery aligned to your active ResMap route. Drag to look around; ResMap re-aligns as your live position moves.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                panoramaRef.current?.setVisible?.(false);
              }}
              className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-slate-950/85 shadow-xl backdrop-blur"
              aria-label="Close live Street View"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {status === "loading" && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
              <div className="flex items-center gap-2 rounded-full bg-slate-950/85 px-4 py-2 text-sm font-bold shadow-xl backdrop-blur"><Loader2 className="h-4 w-4 animate-spin" />Aligning real Street View to your route…</div>
            </div>
          )}

          {status === "unavailable" && (
            <div className="absolute inset-0 z-10 grid place-items-center p-6">
              <div className="max-w-md rounded-[28px] border border-white/15 bg-slate-950/92 p-6 text-center shadow-2xl backdrop-blur-xl">
                <Navigation className="mx-auto h-9 w-9 text-cyan-300" />
                <h2 className="mt-3 text-xl font-black">Street View coverage unavailable here</h2>
                <p className="mt-2 text-sm text-white/70">Your live route is still running. ResMap checked outdoor imagery at your GPS position and nearby route segment instead of showing generated or incorrect imagery.</p>
                {message && <p className="mt-2 text-[11px] text-white/45">{message}</p>}
                <div className="mt-5 flex justify-center gap-2">
                  <Button onClick={() => void resolvePanorama(true)} className="bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300"><LocateFixed className="mr-2 h-4 w-4" />Try current position</Button>
                  <Button variant="outline" onClick={() => setOpen(false)} className="border-white/20 bg-white/5 text-white hover:bg-white/10">Return to route</Button>
                </div>
              </div>
            </div>
          )}

          {status === "ready" && (
            <button
              type="button"
              onClick={() => void resolvePanorama(true)}
              className="absolute bottom-[calc(18px+env(safe-area-inset-bottom))] right-3 z-20 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-slate-950/85 px-4 text-sm font-black text-white shadow-xl backdrop-blur sm:right-5"
              aria-label="Re-align Street View to current route position"
            >
              <LocateFixed className="h-5 w-5 text-cyan-300" />Re-align
            </button>
          )}
        </div>
      )}
    </>
  );
}
