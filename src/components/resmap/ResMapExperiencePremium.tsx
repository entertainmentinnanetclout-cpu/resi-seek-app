import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BedDouble,
  BedSingle,
  Bike,
  Building2,
  Bus,
  Car,
  CheckCircle2,
  CircleDollarSign,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Eye,
  Footprints,
  LocateFixed,
  MapPinned,
  Navigation,
  RefreshCw,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeResidences } from "@/hooks/useRealtimeResidences";
import { isMockResidence, type ResidenceFilters } from "@/hooks/useResidenceFilters";
import {
  requestLiveLocation,
  useLiveLocation,
  distanceKm as liveDistanceKm,
} from "@/lib/resmap/liveLocation";
import {
  campusFilterValue,
  estimateTravelMinutes,
  haversineKm,
  parseSpatialIntent,
  residenceMatchesMapFilters,
  type TravelMode,
} from "@/lib/resmap/spatial";
import ResMapResidenceCard from "./ResMapResidenceCard";

interface Props {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resetFilters: () => void;
  onClose: () => void;
}

interface Campus {
  id: string;
  campus_key: string;
  name: string;
  short_name?: string;
  aliases?: string[];
  latitude?: number;
  longitude?: number;
}

interface MapConfig {
  google_maps_enabled: boolean;
  google_maps_browser_key?: string | null;
  google_maps_map_id?: string | null;
  google_maps_mode?: "ROADMAP" | "SATELLITE" | "HYBRID";
  raster_primary_url?: string | null;
  raster_fallback_url?: string | null;
}

interface RouteStep {
  distance_m: number;
  duration_s: number;
  name: string;
  type: string;
  modifier?: string | null;
  instruction: string;
  bearing_before?: number | null;
  bearing_after?: number | null;
  location: { lat: number; lng: number };
}

interface RouteInfo {
  distance_m: number;
  duration_s: number;
  provider: string;
  profile: TravelMode;
  geometry?: { type?: string; coordinates?: number[][] };
  steps: RouteStep[];
}

type Engine = "reskonnect" | "google3d";
type Health = "starting" | "healthy" | "degraded";
type NavigationView = "route" | "street" | "3d";
type Center = { latitude: number; longitude: number };
type PointerPoint = { x: number; y: number };

const TILE_SIZE = 256;
const EARTH_RADIUS_M = 6378137;
const SOUTH_AFRICA_CENTER: Center = { latitude: -28.55, longitude: 25.45 };
const OSM_PRIMARY = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_FALLBACK = "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const MERCATOR_MAX_LAT = 85.05112878;
const NAV_LOCAL_KEY = "reskonnect_resmap_active_navigation_v3";

const validCoord = (row: any) =>
  Number.isFinite(Number(row?.latitude)) &&
  Number.isFinite(Number(row?.longitude)) &&
  Number(row.latitude) >= -35.5 && Number(row.latitude) <= -21 &&
  Number(row.longitude) >= 15 && Number(row.longitude) <= 34;

const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const availability = (row: any) => Number(row?.available_spots || 0) > 5 ? "available" : Number(row?.available_spots || 0) > 0 ? "limited" : "unknown";
const availabilityTone = (row: any) => availability(row) === "available" ? "text-emerald-700" : availability(row) === "limited" ? "text-amber-700" : "text-blue-700";

function campusMatchesHint(campus: Campus, hint: string) {
  const hay = [campus.name, campus.short_name, ...(campus.aliases || [])].map(normalize).join(" | ");
  const needle = normalize(hint);
  const short = normalize(campus.short_name);
  if (!needle) return false;
  return hay.includes(needle) || (short.length > 1 && needle.includes(short)) || needle.split(" ").filter((token) => token.length > 2).every((token) => hay.includes(token));
}

function sanitizeTileTemplate(value: string | null | undefined, fallback: string) {
  const candidate = String(value || "").trim();
  if (!candidate) return fallback;
  if (/cartocdn\.com/i.test(candidate) && !/[?&]key=/i.test(candidate)) return fallback;
  return candidate;
}

function tileUrl(template: string, z: number, x: number, y: number) {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

function worldSize(zoom: number) { return TILE_SIZE * Math.pow(2, zoom); }

function project(latitude: number, longitude: number, zoom: number) {
  const lat = clamp(latitude, -MERCATOR_MAX_LAT, MERCATOR_MAX_LAT);
  const scale = worldSize(zoom);
  const x = ((longitude + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): Center {
  const scale = worldSize(zoom);
  const longitude = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { latitude: clamp(latitude, -MERCATOR_MAX_LAT, MERCATOR_MAX_LAT), longitude: ((longitude + 540) % 360) - 180 };
}

function metersPerPixel(latitude: number, zoom: number) {
  return Math.cos((latitude * Math.PI) / 180) * 2 * Math.PI * EARTH_RADIUS_M / worldSize(zoom);
}

function fitRows(rows: any[]): { center: Center; zoom: number } | null {
  const valid = rows.filter(validCoord);
  if (!valid.length) return null;
  const lats = valid.map((row) => Number(row.latitude));
  const lngs = valid.map((row) => Number(row.longitude));
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  const zoom = span > 12 ? 4 : span > 7 ? 5 : span > 4 ? 6 : span > 2 ? 7 : span > 1 ? 8 : span > 0.5 ? 9 : span > 0.2 ? 10 : span > 0.08 ? 12 : span > 0.03 ? 13 : 15;
  return { center: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 }, zoom };
}

function bearingBetween(a: Center, b: Center) {
  const toRad = (value: number) => value * Math.PI / 180;
  const toDeg = (value: number) => value * 180 / Math.PI;
  const lat1 = toRad(a.latitude), lat2 = toRad(b.latitude), dLng = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function humanDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function maneuverIcon(step?: RouteStep | null) {
  const modifier = String(step?.modifier || "").toLowerCase();
  const type = String(step?.type || "").toLowerCase();
  if (type.includes("arrive")) return MapPinned;
  if (modifier.includes("left")) return modifier.includes("slight") ? ArrowLeft : CornerUpLeft;
  if (modifier.includes("right")) return modifier.includes("slight") ? ArrowRight : CornerUpRight;
  return ArrowUp;
}

function routeCumulative(coords: number[][]) {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    total += liveDistanceKm(
      { latitude: Number(coords[i - 1][1]), longitude: Number(coords[i - 1][0]) },
      { latitude: Number(coords[i][1]), longitude: Number(coords[i][0]) },
    ) * 1000;
    cumulative.push(total);
  }
  return { cumulative, total };
}

let googleLoader: Promise<any> | null = null;
function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (googleLoader) return googleLoader;
  googleLoader = new Promise((resolve, reject) => {
    const id = "resmap-google-maps-js";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => w.google?.maps?.importLibrary ? resolve(w.google) : reject(new Error("Google Maps did not initialize")), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.onload = () => w.google?.maps?.importLibrary ? resolve(w.google) : reject(new Error("Google Maps did not initialize"));
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    googleLoader = null;
    throw error;
  });
  return googleLoader;
}

export default function ResMapExperiencePremium({ filters, updateFilter, resetFilters, onClose }: Props) {
  const { user } = useAuth();
  const live = useLiveLocation();
  const { residences, loading } = useRealtimeResidences();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const googleNode = useRef<HTMLDivElement | null>(null);
  const streetNode = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const streetPanoramaRef = useRef<any>(null);
  const streetServiceRef = useRef<any>(null);
  const streetLastPointRef = useRef<Center | null>(null);
  const streetLastUpdateRef = useRef(0);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const dragRef = useRef<{ point: PointerPoint; centerWorld: PointerPoint; zoom: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const initialFitDone = useRef(false);
  const navigationSessionIdRef = useRef<string | null>(null);
  const lastSessionSyncRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const lastStepLoggedRef = useRef(-1);

  const [engine, setEngine] = useState<Engine>("reskonnect");
  const [health, setHealth] = useState<Health>("starting");
  const [config, setConfig] = useState<MapConfig>({ google_maps_enabled: false });
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [center, setCenter] = useState<Center>(SOUTH_AFRICA_CENTER);
  const [zoom, setZoom] = useState(5);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [selectedCampusKey, setSelectedCampusKey] = useState("");
  const [orbitRadiusKm, setOrbitRadiusKm] = useState(3);
  const [travelMode, setTravelMode] = useState<TravelMode>("walk");
  const [travelTimeMax, setTravelTimeMax] = useState(0);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("Ask Dimpho to reshape the live map around what you need.");
  const [tileErrors, setTileErrors] = useState(0);
  const [navigationActive, setNavigationActive] = useState(false);
  const [navigationView, setNavigationView] = useState<NavigationView>("route");
  const [followUser, setFollowUser] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [remainingDistanceM, setRemainingDistanceM] = useState(0);
  const [remainingDurationS, setRemainingDurationS] = useState(0);
  const [routeDeviationM, setRouteDeviationM] = useState(0);
  const [streetReady, setStreetReady] = useState(false);
  const [streetUnavailable, setStreetUnavailable] = useState(false);
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setViewport({ width: node.clientWidth, height: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    window.addEventListener("orientationchange", update, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("orientationchange", update); };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [campusRes, configRes] = await Promise.all([
        (supabase as any).from("resmap_campuses").select("id,campus_key,name,short_name,aliases,latitude,longitude").eq("is_active", true).order("name"),
        (supabase as any).from("resmap_map_config").select("google_maps_enabled,google_maps_browser_key,google_maps_map_id,google_maps_mode,raster_primary_url,raster_fallback_url").eq("id", 1).maybeSingle(),
      ]);
      if (!active) return;
      setCampuses((campusRes.data || []).filter((campus: Campus) => Number.isFinite(Number(campus.latitude)) && Number.isFinite(Number(campus.longitude))));
      if (configRes.data) setConfig(configRes.data as MapConfig);
    })();
    return () => { active = false; };
  }, []);

  const primaryTiles = sanitizeTileTemplate(config.raster_primary_url, OSM_PRIMARY);
  const fallbackTiles = sanitizeTileTemplate(config.raster_fallback_url, OSM_FALLBACK);
  const googleReady = Boolean(config.google_maps_enabled && config.google_maps_browser_key);
  const selectedCampus = useMemo(() => campuses.find((campus) => campus.campus_key === selectedCampusKey) || null, [campuses, selectedCampusKey]);
  const userLocation = live.position ? { latitude: live.position.latitude, longitude: live.position.longitude } : null;

  useEffect(() => {
    if (!campuses.length || filters.campus === "all") return;
    const match = campuses.find((campus) => campusMatchesHint(campus, filters.campus));
    if (match && match.campus_key !== selectedCampusKey) setSelectedCampusKey(match.campus_key);
  }, [campuses, filters.campus, selectedCampusKey]);

  const baseMatching = useMemo(() => residences.filter((row: any) => !isMockResidence(row) && row.map_hidden !== true && row.is_visible !== false && residenceMatchesMapFilters(row, filters)), [residences, filters]);
  const mappedMatching = useMemo(() => baseMatching.filter(validCoord), [baseMatching]);
  const displayedMapped = useMemo(() => {
    const origin = selectedCampus
      ? { latitude: Number(selectedCampus.latitude), longitude: Number(selectedCampus.longitude) }
      : userLocation;
    if (!origin) return mappedMatching;
    return mappedMatching.filter((row: any) => {
      const km = haversineKm(origin, { latitude: Number(row.latitude), longitude: Number(row.longitude) });
      if (selectedCampus && orbitRadiusKm > 0 && km > orbitRadiusKm) return false;
      if (travelTimeMax > 0 && estimateTravelMinutes(km, travelMode) > travelTimeMax) return false;
      return true;
    }).sort((a: any, b: any) => {
      if (!userLocation) return 0;
      const da = haversineKm(userLocation, { latitude: Number(a.latitude), longitude: Number(a.longitude) });
      const db = haversineKm(userLocation, { latitude: Number(b.latitude), longitude: Number(b.longitude) });
      return da - db;
    });
  }, [mappedMatching, orbitRadiusKm, selectedCampus, travelMode, travelTimeMax, userLocation?.latitude, userLocation?.longitude]);

  const allMapped = useMemo(() => residences.filter((row: any) => !isMockResidence(row) && row.map_hidden !== true && row.is_visible !== false && validCoord(row)), [residences]);
  const realCount = useMemo(() => residences.filter((row: any) => !isMockResidence(row)).length, [residences]);
  const readiness = realCount ? Math.round((allMapped.length / realCount) * 100) : 0;

  useEffect(() => {
    if (navigationActive) return;
    if (selectedCampus) {
      setCenter({ latitude: Number(selectedCampus.latitude), longitude: Number(selectedCampus.longitude) });
      setZoom(orbitRadiusKm === 0 ? 11 : orbitRadiusKm <= 0.5 ? 15 : orbitRadiusKm <= 1 ? 14 : orbitRadiusKm <= 2 ? 13 : orbitRadiusKm <= 3 ? 12 : 11);
      return;
    }
    if (live.status === "granted" && userLocation && !initialFitDone.current) {
      setCenter(userLocation);
      setZoom(13);
      initialFitDone.current = true;
      return;
    }
    if (initialFitDone.current || !displayedMapped.length) return;
    const fit = fitRows(displayedMapped);
    if (fit) { setCenter(fit.center); setZoom(fit.zoom); initialFitDone.current = true; }
  }, [displayedMapped, live.status, navigationActive, orbitRadiusKm, selectedCampus, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (!navigationActive || !followUser || !userLocation || engine !== "reskonnect") return;
    setCenter(userLocation);
    setZoom((current) => Math.max(17, current));
  }, [engine, followUser, navigationActive, userLocation?.latitude, userLocation?.longitude]);

  const centerWorld = useMemo(() => project(center.latitude, center.longitude, zoom), [center, zoom]);
  const sizeWorld = worldSize(zoom);

  const toPixel = useCallback((latitude: number, longitude: number) => {
    const point = project(latitude, longitude, zoom);
    let dx = point.x - centerWorld.x;
    if (dx > sizeWorld / 2) dx -= sizeWorld;
    if (dx < -sizeWorld / 2) dx += sizeWorld;
    return { x: viewport.width / 2 + dx, y: viewport.height / 2 + (point.y - centerWorld.y) };
  }, [centerWorld.x, centerWorld.y, sizeWorld, viewport.height, viewport.width, zoom]);

  const tiles = useMemo(() => {
    if (!viewport.width || !viewport.height) return [] as Array<{ key: string; z: number; x: number; y: number; left: number; top: number }>;
    const n = Math.pow(2, zoom);
    const minX = Math.floor((centerWorld.x - viewport.width / 2) / TILE_SIZE) - 1;
    const maxX = Math.floor((centerWorld.x + viewport.width / 2) / TILE_SIZE) + 1;
    const minY = Math.floor((centerWorld.y - viewport.height / 2) / TILE_SIZE) - 1;
    const maxY = Math.floor((centerWorld.y + viewport.height / 2) / TILE_SIZE) + 1;
    const result: Array<{ key: string; z: number; x: number; y: number; left: number; top: number }> = [];
    for (let tx = minX; tx <= maxX; tx += 1) {
      const wrappedX = ((tx % n) + n) % n;
      for (let ty = minY; ty <= maxY; ty += 1) {
        if (ty < 0 || ty >= n) continue;
        result.push({ key: `${zoom}-${tx}-${ty}`, z: zoom, x: wrappedX, y: ty, left: tx * TILE_SIZE - centerWorld.x + viewport.width / 2, top: ty * TILE_SIZE - centerWorld.y + viewport.height / 2 });
      }
    }
    return result;
  }, [centerWorld.x, centerWorld.y, viewport.height, viewport.width, zoom]);

  const visibleResidenceMarkers = useMemo(() => displayedMapped.map((row: any) => ({ row, ...toPixel(Number(row.latitude), Number(row.longitude)) })).filter((item) => item.x > -120 && item.x < viewport.width + 120 && item.y > -120 && item.y < viewport.height + 120), [displayedMapped, toPixel, viewport.height, viewport.width]);

  const clusters = useMemo(() => {
    const grid = zoom <= 8 ? 74 : zoom <= 11 ? 62 : zoom <= 12 ? 50 : 0;
    if (!grid) return visibleResidenceMarkers.map((item) => ({ type: "single" as const, items: [item], x: item.x, y: item.y, key: String(item.row.id) }));
    const buckets = new Map<string, typeof visibleResidenceMarkers>();
    visibleResidenceMarkers.forEach((item) => {
      const key = `${Math.floor(item.x / grid)}:${Math.floor(item.y / grid)}`;
      const group = buckets.get(key) || [];
      group.push(item);
      buckets.set(key, group);
    });
    return Array.from(buckets.entries()).map(([key, items]) => ({
      type: items.length > 1 ? "cluster" as const : "single" as const,
      items,
      x: items.reduce((sum, item) => sum + item.x, 0) / items.length,
      y: items.reduce((sum, item) => sum + item.y, 0) / items.length,
      key,
    }));
  }, [visibleResidenceMarkers, zoom]);

  const campusMarkers = useMemo(() => campuses.map((campus) => ({ campus, ...toPixel(Number(campus.latitude), Number(campus.longitude)) })).filter((item) => item.x > -80 && item.x < viewport.width + 80 && item.y > -80 && item.y < viewport.height + 80), [campuses, toPixel, viewport.height, viewport.width]);
  const selectedPixel = selectedResidence && validCoord(selectedResidence) ? toPixel(Number(selectedResidence.latitude), Number(selectedResidence.longitude)) : null;
  const userPixel = userLocation ? toPixel(userLocation.latitude, userLocation.longitude) : null;
  const campusPixel = selectedCampus ? toPixel(Number(selectedCampus.latitude), Number(selectedCampus.longitude)) : null;
  const orbitRadiusPx = selectedCampus && orbitRadiusKm > 0 ? (orbitRadiusKm * 1000) / Math.max(0.01, metersPerPixel(Number(selectedCampus.latitude), zoom)) : 0;
  const accuracyRadiusPx = live.position && userLocation ? Math.min(220, live.position.accuracy / Math.max(0.01, metersPerPixel(userLocation.latitude, zoom))) : 0;

  const routeCoords = useMemo(() => Array.isArray(routeInfo?.geometry?.coordinates) ? routeInfo!.geometry!.coordinates! : [], [routeInfo]);
  const routeMetrics = useMemo(() => routeCumulative(routeCoords), [routeCoords]);
  const routePath = useMemo(() => {
    if (routeCoords.length < 2) return "";
    return routeCoords.map((coord: number[], index: number) => {
      const point = toPixel(Number(coord[1]), Number(coord[0]));
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" ");
  }, [routeCoords, toPixel]);

  const setZoomSafe = (next: number) => setZoom(clamp(Math.round(next), 3, 19));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (navigationView === "street") return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { point: { x: event.clientX, y: event.clientY }, centerWorld: project(center.latitude, center.longitude, zoom), zoom };
      pinchRef.current = null;
      if (navigationActive) setFollowUser(false);
    } else if (pointersRef.current.size === 2) {
      const points = Array.from(pointersRef.current.values());
      pinchRef.current = { distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), zoom };
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1 && dragRef.current) {
      const dx = event.clientX - dragRef.current.point.x;
      const dy = event.clientY - dragRef.current.point.y;
      setCenter(unproject(dragRef.current.centerWorld.x - dx, dragRef.current.centerWorld.y - dy, dragRef.current.zoom));
    } else if (pointersRef.current.size === 2 && pinchRef.current) {
      const points = Array.from(pointersRef.current.values());
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const next = pinchRef.current.zoom + Math.log2(distance / Math.max(1, pinchRef.current.distance));
      const rounded = clamp(Math.round(next), 3, 19);
      if (rounded !== zoom) setZoom(rounded);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      dragRef.current = { point: remaining, centerWorld: project(center.latitude, center.longitude, zoom), zoom };
      pinchRef.current = null;
    } else {
      dragRef.current = null;
      pinchRef.current = null;
    }
  };

  const selectResidence = (row: any) => {
    if (navigationActive) return;
    setSelectedResidence(row);
    setRouteInfo(null);
    setCenter({ latitude: Number(row.latitude), longitude: Number(row.longitude) });
    setZoom((current) => Math.max(15, current));
  };

  useEffect(() => {
    if (engine !== "google3d" || !googleNode.current || !googleReady || !config.google_maps_browser_key) return;
    let disposed = false;
    setHealth("starting");
    loadGoogleMaps(config.google_maps_browser_key).then(async (google) => {
      const { Map3DElement } = await google.maps.importLibrary("maps3d");
      if (disposed || !googleNode.current) return;
      const target = navigationActive && userLocation ? userLocation : center;
      const map3d = new Map3DElement({
        center: { lat: target.latitude, lng: target.longitude, altitude: 0 },
        tilt: navigationActive ? 72 : 67.5,
        heading: navigationActive ? (live.effectiveHeading ?? 0) : 0,
        range: navigationActive ? 650 : zoom >= 15 ? 1600 : zoom >= 12 ? 8000 : 220000,
        mode: config.google_maps_mode || "HYBRID",
        ...(config.google_maps_map_id ? { mapId: config.google_maps_map_id } : {}),
      });
      map3d.style.width = "100%";
      map3d.style.height = "100%";
      googleNode.current.replaceChildren(map3d);
      googleMapRef.current = map3d;
      setHealth("healthy");
    }).catch((error) => {
      if (disposed) return;
      console.error("Google photorealistic 3D failed", error);
      toast.error("Photorealistic 3D could not initialize. ResMap returned to the live route map.");
      setEngine("reskonnect");
      setNavigationView("route");
      setHealth("degraded");
    });
    return () => {
      disposed = true;
      googleMarkersRef.current.forEach((marker) => { try { marker.remove(); } catch { /* no-op */ } });
      googleMarkersRef.current = [];
      if (googleNode.current) googleNode.current.replaceChildren();
      googleMapRef.current = null;
    };
  }, [config.google_maps_browser_key, config.google_maps_map_id, config.google_maps_mode, center.latitude, center.longitude, engine, googleReady, live.effectiveHeading, navigationActive, userLocation?.latitude, userLocation?.longitude, zoom]);

  useEffect(() => {
    if (engine !== "google3d" || !googleMapRef.current || !googleReady) return;
    let active = true;
    (async () => {
      try {
        const google = (window as any).google;
        const { Marker3DInteractiveElement } = await google.maps.importLibrary("maps3d");
        if (!active || !googleMapRef.current) return;
        googleMarkersRef.current.forEach((marker) => { try { marker.remove(); } catch { /* no-op */ } });
        googleMarkersRef.current = (navigationActive && selectedResidence ? [selectedResidence] : displayedMapped.slice(0, 160)).map((row: any) => {
          const marker = new Marker3DInteractiveElement({
            position: { lat: Number(row.latitude), lng: Number(row.longitude), altitude: 0 },
            label: String(row.name || "Residence").slice(0, 42),
            title: String(row.name || "Residence"),
            extruded: true,
            sizePreserved: true,
          });
          marker.addEventListener("gmp-click", () => selectResidence(row));
          googleMapRef.current.append(marker);
          return marker;
        });
      } catch (error) {
        console.warn("Google 3D residence markers failed", error);
      }
    })();
    return () => { active = false; };
  }, [displayedMapped, engine, googleReady, navigationActive, selectedResidence]);

  const chooseCampus = (campusKey: string) => {
    setSelectedCampusKey(campusKey);
    const campus = campuses.find((row) => row.campus_key === campusKey);
    updateFilter("campus", campus ? campusFilterValue(campus) : "all");
    setSelectedResidence(null);
    setRouteInfo(null);
    if (campus) {
      setCenter({ latitude: Number(campus.latitude), longitude: Number(campus.longitude) });
      setZoom(12);
    }
  };

  const locateMe = async () => {
    const ok = live.status === "granted" || await requestLiveLocation();
    const snapshot = live.position;
    if (!ok && !snapshot) {
      toast.error("Enable Location for reskonnect.org in your browser to use live routing.");
      return;
    }
    const next = snapshot ? { latitude: snapshot.latitude, longitude: snapshot.longitude } : userLocation;
    if (next) {
      setCenter(next);
      setZoom(navigationActive ? 17 : 15);
      setFollowUser(true);
    }
  };

  const logNavigationEvent = useCallback(async (eventType: string, payload: Record<string, unknown> = {}) => {
    if (!user?.id || !navigationSessionIdRef.current) return;
    try {
      await (supabase as any).from("resmap_navigation_events").insert({
        session_id: navigationSessionIdRef.current,
        user_id: user.id,
        event_type: eventType,
        latitude: live.position?.latitude ?? null,
        longitude: live.position?.longitude ?? null,
        payload,
      });
    } catch {
      // Navigation must never fail because analytics logging failed.
    }
  }, [live.position?.latitude, live.position?.longitude, user?.id]);

  const startNavigationSession = async (residence: any, info: RouteInfo, origin: Center) => {
    const local = {
      residence_id: residence.id,
      profile: travelMode,
      route: info,
      started_at: new Date().toISOString(),
    };
    try { window.localStorage.setItem(NAV_LOCAL_KEY, JSON.stringify(local)); } catch { /* optional */ }
    if (!user?.id) return;
    try {
      const { data } = await (supabase as any).from("resmap_navigation_sessions").insert({
        user_id: user.id,
        residence_id: residence.id,
        profile: travelMode,
        status: "active",
        origin_lat: origin.latitude,
        origin_lng: origin.longitude,
        destination_lat: Number(residence.latitude),
        destination_lng: Number(residence.longitude),
        distance_m: info.distance_m,
        duration_s: info.duration_s,
        route_geometry: info.geometry || null,
        steps: info.steps || [],
        provider: info.provider,
        last_lat: origin.latitude,
        last_lng: origin.longitude,
        remaining_m: info.distance_m,
        eta_at: new Date(Date.now() + info.duration_s * 1000).toISOString(),
        metadata: { source: "find_my_res", user_agent: navigator.userAgent.slice(0, 240) },
      }).select("id").single();
      if (data?.id) {
        navigationSessionIdRef.current = data.id;
        await (supabase as any).from("resmap_navigation_events").insert({ session_id: data.id, user_id: user.id, event_type: "session_started", latitude: origin.latitude, longitude: origin.longitude, payload: { profile: travelMode } });
      }
    } catch {
      // Local navigation still works for signed-in users if session sync is temporarily unavailable.
    }
  };

  const buildRoute = useCallback(async (origin: Center, residence: any, opts?: { reroute?: boolean; enterNavigation?: boolean }) => {
    if (!residence || !validCoord(residence)) return null;
    const id = opts?.reroute ? "resmap-reroute" : "resmap-route";
    if (!opts?.reroute) toast.loading("Preparing live navigation…", { id });
    const destination = { lat: Number(residence.latitude), lng: Number(residence.longitude) };
    const { data, error } = await supabase.functions.invoke("resmap-spatial", {
      body: { action: "route", origin: { lat: origin.latitude, lng: origin.longitude }, destination, profile: travelMode },
    });
    if (error || !data?.ok) {
      if (!opts?.reroute) toast.error(data?.error || error?.message || "Could not build route", { id });
      return null;
    }
    const info: RouteInfo = {
      distance_m: Number(data.distance_m),
      duration_s: Number(data.duration_s),
      provider: String(data.provider),
      profile: travelMode,
      geometry: data.geometry,
      steps: Array.isArray(data.steps) ? data.steps : [],
    };
    setRouteInfo(info);
    setRemainingDistanceM(info.distance_m);
    setRemainingDurationS(info.duration_s);
    setCurrentStepIndex(0);
    if (opts?.enterNavigation !== false) {
      setSelectedResidence(residence);
      setNavigationActive(true);
      setArrived(false);
      setFollowUser(true);
      setEngine("reskonnect");
      setNavigationView("route");
      setCenter(origin);
      setZoom(17);
      if (!opts?.reroute) await startNavigationSession(residence, info, origin);
      if (googleReady) setNavigationView("street");
    }
    if (opts?.reroute) {
      void logNavigationEvent("rerouted", { distance_m: info.distance_m, duration_s: info.duration_s, provider: info.provider });
    } else {
      toast.success(`${Math.max(1, Math.round(info.duration_s / 60))} min · ${(info.distance_m / 1000).toFixed(1)} km`, { id });
    }
    return info;
  }, [googleReady, logNavigationEvent, travelMode, user?.id]);

  const requestRoute = async () => {
    if (!selectedResidence || !validCoord(selectedResidence)) return;
    let origin = userLocation;
    if (live.status !== "granted" || !origin) {
      const ok = await requestLiveLocation();
      const latest = live.position;
      if (!ok && !latest) {
        toast.info("Live Location is required to start turn-by-turn routing from your current position.");
        return;
      }
      origin = latest ? { latitude: latest.latitude, longitude: latest.longitude } : origin;
    }
    if (!origin) {
      toast.info("ResMap is waiting for your first GPS fix. Keep Location enabled and try again in a moment.");
      return;
    }
    await buildRoute(origin, selectedResidence, { enterNavigation: true });
  };

  const endNavigation = async (status: "completed" | "cancelled") => {
    const sessionId = navigationSessionIdRef.current;
    if (user?.id && sessionId) {
      try {
        await (supabase as any).from("resmap_navigation_sessions").update({
          status,
          ended_at: new Date().toISOString(),
          remaining_m: Math.round(remainingDistanceM),
          last_lat: live.position?.latitude ?? null,
          last_lng: live.position?.longitude ?? null,
          last_seen_at: new Date().toISOString(),
        }).eq("id", sessionId).eq("user_id", user.id);
        await (supabase as any).from("resmap_navigation_events").insert({ session_id: sessionId, user_id: user.id, event_type: status === "completed" ? "arrived" : "session_cancelled", latitude: live.position?.latitude ?? null, longitude: live.position?.longitude ?? null, payload: {} });
      } catch { /* navigation exit still succeeds */ }
    }
    try { window.localStorage.removeItem(NAV_LOCAL_KEY); } catch { /* optional */ }
    navigationSessionIdRef.current = null;
    setNavigationActive(false);
    setNavigationView("route");
    setEngine("reskonnect");
    setRouteInfo(null);
    setCurrentStepIndex(0);
    setStreetReady(false);
    setStreetUnavailable(false);
    setArrived(false);
    if (selectedResidence) {
      setCenter({ latitude: Number(selectedResidence.latitude), longitude: Number(selectedResidence.longitude) });
      setZoom(15);
    }
  };

  useEffect(() => {
    if (!navigationActive || !routeInfo || !userLocation || routeCoords.length < 2) return;
    let closestIndex = 0;
    let closestM = Number.POSITIVE_INFINITY;
    for (let i = 0; i < routeCoords.length; i += 1) {
      const coord = routeCoords[i];
      const meters = liveDistanceKm(userLocation, { latitude: Number(coord[1]), longitude: Number(coord[0]) }) * 1000;
      if (meters < closestM) { closestM = meters; closestIndex = i; }
    }
    const progressed = routeMetrics.cumulative[Math.min(closestIndex, routeMetrics.cumulative.length - 1)] || 0;
    const routeTotal = Math.max(routeMetrics.total, routeInfo.distance_m, 1);
    const remaining = Math.max(0, routeTotal - progressed);
    const duration = Math.max(0, routeInfo.duration_s * (remaining / routeTotal));
    setRouteDeviationM(closestM);
    setRemainingDistanceM(remaining);
    setRemainingDurationS(duration);

    if (routeInfo.steps.length) {
      let nextIndex = currentStepIndex;
      while (nextIndex < routeInfo.steps.length - 1) {
        const step = routeInfo.steps[nextIndex];
        const stepDistance = liveDistanceKm(userLocation, { latitude: step.location.lat, longitude: step.location.lng }) * 1000;
        const threshold = Math.max(22, Math.min(60, (live.position?.accuracy || 10) * 1.4));
        if (stepDistance <= threshold) nextIndex += 1;
        else break;
      }
      if (nextIndex !== currentStepIndex) setCurrentStepIndex(nextIndex);
    }

    const destinationDistance = selectedResidence ? liveDistanceKm(userLocation, { latitude: Number(selectedResidence.latitude), longitude: Number(selectedResidence.longitude) }) * 1000 : Number.POSITIVE_INFINITY;
    if (destinationDistance <= Math.max(20, (live.position?.accuracy || 10) * 1.4) && !arrived) {
      setArrived(true);
      setRemainingDistanceM(0);
      setRemainingDurationS(0);
      void logNavigationEvent("arrival_detected", { accuracy_m: live.position?.accuracy || null });
    }

    if (closestM > 85 && selectedResidence && Date.now() - lastRerouteRef.current > 15000) {
      lastRerouteRef.current = Date.now();
      void buildRoute(userLocation, selectedResidence, { reroute: true, enterNavigation: false });
    }
  }, [arrived, buildRoute, currentStepIndex, live.position?.accuracy, logNavigationEvent, navigationActive, routeCoords, routeInfo, routeMetrics.cumulative, routeMetrics.total, selectedResidence, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (!navigationActive || currentStepIndex === lastStepLoggedRef.current) return;
    lastStepLoggedRef.current = currentStepIndex;
    const step = routeInfo?.steps?.[currentStepIndex];
    void logNavigationEvent("step_changed", { step_index: currentStepIndex, instruction: step?.instruction || null });
  }, [currentStepIndex, logNavigationEvent, navigationActive, routeInfo?.steps]);

  useEffect(() => {
    if (!navigationActive || !user?.id || !navigationSessionIdRef.current || !live.position) return;
    const now = Date.now();
    if (now - lastSessionSyncRef.current < 10000) return;
    lastSessionSyncRef.current = now;
    const etaAt = new Date(now + remainingDurationS * 1000).toISOString();
    void (supabase as any).from("resmap_navigation_sessions").update({
      last_lat: live.position.latitude,
      last_lng: live.position.longitude,
      last_accuracy_m: Math.round(live.position.accuracy),
      last_heading: live.effectiveHeading == null ? null : Math.round(live.effectiveHeading),
      last_speed_mps: live.position.speed,
      last_seen_at: new Date(now).toISOString(),
      remaining_m: Math.round(remainingDistanceM),
      progress_m: Math.max(0, Math.round((routeInfo?.distance_m || 0) - remainingDistanceM)),
      eta_at: etaAt,
      current_step_index: currentStepIndex,
    }).eq("id", navigationSessionIdRef.current).eq("user_id", user.id);
  }, [currentStepIndex, live.effectiveHeading, live.position, navigationActive, remainingDistanceM, remainingDurationS, routeInfo?.distance_m, user?.id]);

  useEffect(() => {
    if (!navigationActive || navigationView !== "street" || !googleReady || !config.google_maps_browser_key || !streetNode.current || !userLocation) return;
    let disposed = false;
    setStreetUnavailable(false);
    loadGoogleMaps(config.google_maps_browser_key).then(async (google) => {
      const { StreetViewPanorama, StreetViewService } = await google.maps.importLibrary("streetView");
      if (disposed || !streetNode.current) return;
      if (!streetServiceRef.current) streetServiceRef.current = new StreetViewService();
      const service = streetServiceRef.current;
      const response = await service.getPanorama({ location: { lat: userLocation.latitude, lng: userLocation.longitude }, radius: 100, preference: "nearest", source: "outdoor" });
      if (disposed || !streetNode.current || !response?.data?.location?.pano) return;
      const nextStep = routeInfo?.steps?.[currentStepIndex];
      const routeHeading = nextStep?.bearing_after ?? (nextStep ? bearingBetween(userLocation, { latitude: nextStep.location.lat, longitude: nextStep.location.lng }) : null);
      const heading = live.effectiveHeading ?? routeHeading ?? 0;
      const panorama = new StreetViewPanorama(streetNode.current, {
        pano: response.data.location.pano,
        pov: { heading, pitch: 0 },
        zoom: 1,
        addressControl: false,
        fullscreenControl: false,
        linksControl: true,
        motionTracking: true,
        motionTrackingControl: false,
        panControl: false,
        zoomControl: false,
        enableCloseButton: false,
        visible: true,
      });
      streetPanoramaRef.current = panorama;
      streetLastPointRef.current = userLocation;
      streetLastUpdateRef.current = Date.now();
      setStreetReady(true);
    }).catch((error) => {
      console.warn("Street View unavailable for current route", error);
      if (!disposed) { setStreetUnavailable(true); setStreetReady(false); setNavigationView("route"); }
    });
    return () => { disposed = true; };
  }, [config.google_maps_browser_key, currentStepIndex, googleReady, live.effectiveHeading, navigationActive, navigationView, routeInfo?.steps, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (!navigationActive || navigationView !== "street" || !streetPanoramaRef.current || !streetServiceRef.current || !userLocation) return;
    const last = streetLastPointRef.current;
    const moved = last ? liveDistanceKm(last, userLocation) * 1000 : 999;
    if (moved < 18 && Date.now() - streetLastUpdateRef.current < 5000) {
      const nextStep = routeInfo?.steps?.[currentStepIndex];
      const routeHeading = nextStep?.bearing_after ?? (nextStep ? bearingBetween(userLocation, { latitude: nextStep.location.lat, longitude: nextStep.location.lng }) : null);
      const heading = live.effectiveHeading ?? routeHeading;
      if (heading != null) streetPanoramaRef.current.setPov({ ...streetPanoramaRef.current.getPov(), heading });
      return;
    }
    streetLastUpdateRef.current = Date.now();
    streetServiceRef.current.getPanorama({ location: { lat: userLocation.latitude, lng: userLocation.longitude }, radius: 100, preference: "nearest", source: "outdoor" }).then((response: any) => {
      const pano = response?.data?.location?.pano;
      if (!pano || !streetPanoramaRef.current) return;
      streetPanoramaRef.current.setPano(pano);
      streetLastPointRef.current = userLocation;
      const nextStep = routeInfo?.steps?.[currentStepIndex];
      const routeHeading = nextStep?.bearing_after ?? (nextStep ? bearingBetween(userLocation, { latitude: nextStep.location.lat, longitude: nextStep.location.lng }) : null);
      const heading = live.effectiveHeading ?? routeHeading;
      if (heading != null) streetPanoramaRef.current.setPov({ ...streetPanoramaRef.current.getPov(), heading });
    }).catch(() => setStreetUnavailable(true));
  }, [currentStepIndex, live.effectiveHeading, navigationActive, navigationView, routeInfo?.steps, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (!residences.length || navigationActive || routeInfo) return;
    try {
      const raw = window.localStorage.getItem(NAV_LOCAL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const started = Date.parse(saved?.started_at || "");
      if (!Number.isFinite(started) || Date.now() - started > 6 * 60 * 60 * 1000) {
        window.localStorage.removeItem(NAV_LOCAL_KEY);
        return;
      }
      const residence = residences.find((row: any) => String(row.id) === String(saved?.residence_id));
      if (!residence || !saved?.route?.geometry) return;
      setSelectedResidence(residence);
      setTravelMode(saved.profile || "walk");
      setRouteInfo(saved.route as RouteInfo);
      setNavigationActive(true);
      setRemainingDistanceM(Number(saved.route.distance_m || 0));
      setRemainingDurationS(Number(saved.route.duration_s || 0));
      setFollowUser(true);
      if (live.status === "granted" && userLocation) { setCenter(userLocation); setZoom(17); }
    } catch { /* stale local navigation state is ignored */ }
  }, [live.status, navigationActive, residences, routeInfo, userLocation?.latitude, userLocation?.longitude]);

  const applyCampusHint = (hint?: string | null) => {
    if (!hint) return false;
    const campus = campuses.find((row) => campusMatchesHint(row, hint));
    if (campus) { chooseCampus(campus.campus_key); return true; }
    updateFilter("campus", hint as any);
    return false;
  };

  const runAiSearch = async () => {
    const query = aiQuery.trim();
    if (!query) return;
    setAiLoading(true);
    const parsed = parseSpatialIntent(query);
    try {
      for (const [key, value] of Object.entries(parsed.filterPatch)) if (value !== undefined) updateFilter(key as keyof ResidenceFilters, value as any);
      if (parsed.campusHint) applyCampusHint(parsed.campusHint);
      if (parsed.travelMode) setTravelMode(parsed.travelMode);
      if (parsed.travelTimeMax) setTravelTimeMax(parsed.travelTimeMax);
      if (parsed.understood.length >= 2 || (parsed.understood.length >= 1 && parsed.campusHint)) {
        setAiSummary(`Mapped: ${parsed.understood.join(" · ")}`);
      } else {
        const { data, error } = await supabase.functions.invoke("resmap-spatial", { body: { action: "ai_intent", query } });
        if (error || !data?.ok) throw new Error(data?.error || error?.message || "AI map search failed");
        const result = data.filters || {};
        if (result.campus) applyCampusHint(result.campus);
        if (typeof result.nsfasOnly === "boolean") updateFilter("nsfasOnly", result.nsfasOnly);
        if (Number(result.priceMax) > 0) updateFilter("priceMax", Number(result.priceMax));
        if (result.roomType) { updateFilter("roomTypes", [String(result.roomType)]); updateFilter("singlesOnly", /single/i.test(String(result.roomType))); }
        if (typeof result.wifiOnly === "boolean") updateFilter("wifiOnly", result.wifiOnly);
        if (typeof result.parkingOnly === "boolean") updateFilter("parkingOnly", result.parkingOnly);
        if (["all", "available", "few_spots"].includes(result.availability)) updateFilter("availability", result.availability);
        if (result.searchQuery) updateFilter("searchQuery", String(result.searchQuery));
        if (["walk", "bike", "drive", "transport"].includes(result.travelMode)) setTravelMode(result.travelMode);
        if (Number(result.travelTimeMax) > 0) setTravelTimeMax(Number(result.travelTimeMax));
        if (result.summary) setAiSummary(result.summary);
      }
    } catch (error: any) { toast.error(error?.message || "Could not understand that map search"); }
    finally { setAiLoading(false); }
  };

  const quickFilters = [
    { label: "NSFAS", active: filters.nsfasOnly, icon: CircleDollarSign, action: () => updateFilter("nsfasOnly", !filters.nsfasOnly) },
    { label: "Wi-Fi", active: filters.wifiOnly, icon: Wifi, action: () => updateFilter("wifiOnly", !filters.wifiOnly) },
    { label: "Single", active: filters.singlesOnly, icon: BedSingle, action: () => { const next = !filters.singlesOnly; updateFilter("singlesOnly", next); updateFilter("roomTypes", next ? ["single"] : []); } },
    { label: "Available", active: filters.availability === "available", icon: CheckCircle2, action: () => updateFilter("availability", filters.availability === "available" ? "all" : "available") },
  ];
  const modes: Array<{ mode: TravelMode; label: string; icon: any }> = [
    { mode: "walk", label: "Walk", icon: Footprints },
    { mode: "bike", label: "Bike", icon: Bike },
    { mode: "drive", label: "Drive", icon: Car },
    { mode: "transport", label: "Transport", icon: Bus },
  ];

  const Controls = () => <div className="space-y-4">
    <div>
      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Campus orbit</p><Badge variant="outline">{displayedMapped.length} mapped</Badge></div>
      <select value={selectedCampusKey} onChange={(event) => chooseCampus(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-900 outline-none dark:bg-slate-900 dark:text-white">
        <option value="">Near me / all areas</option>{campuses.map((campus) => <option key={campus.id} value={campus.campus_key}>{campus.name}</option>)}
      </select>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{[0, 0.5, 1, 2, 3, 5].map((radius) => <button key={radius} onClick={() => setOrbitRadiusKm(radius)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${orbitRadiusKm === radius ? "bg-violet-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>{radius === 0 ? "Any" : `${radius} km`}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">Travel-time search</p>
      <div className="grid grid-cols-4 gap-1.5">{modes.map(({ mode, label, icon: Icon }) => <button key={mode} onClick={() => setTravelMode(mode)} className={`rounded-xl px-1 py-2 text-[10px] font-bold ${travelMode === mode ? "bg-[#07192e] text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{[0, 10, 15, 20, 30, 45].map((minutes) => <button key={minutes} onClick={() => setTravelTimeMax(minutes)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${travelTimeMax === minutes ? "bg-cyan-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>{minutes === 0 ? "Any time" : `≤ ${minutes} min`}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">Live Find My Res filters</p>
      <div className="flex flex-wrap gap-1.5">{quickFilters.map(({ label, active, icon: Icon, action }) => <button key={label} onClick={action} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-blue-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}><Icon className="mr-1 inline h-3.5 w-3.5" />{label}</button>)}</div>
      <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">Max rent: R{filters.priceMax.toLocaleString("en-ZA")}</label>
      <input type="range" min={1500} max={10000} step={250} value={filters.priceMax} onChange={(event) => updateFilter("priceMax", Number(event.target.value))} className="mt-1 w-full accent-blue-600" />
      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { resetFilters(); setSelectedCampusKey(""); setTravelTimeMax(0); setOrbitRadiusKm(3); setSelectedResidence(null); setRouteInfo(null); initialFitDone.current = false; }}>Reset map search</Button>
    </div>
  </div>;

  const nextStep = routeInfo?.steps?.[currentStepIndex] || null;
  const ManeuverIcon = maneuverIcon(nextStep);
  const eta = useMemo(() => new Date(Date.now() + Math.max(0, remainingDurationS) * 1000), [remainingDurationS]);
  const userHeading = live.effectiveHeading ?? (nextStep && userLocation ? bearingBetween(userLocation, { latitude: nextStep.location.lat, longitude: nextStep.location.lng }) : 0);

  return <div className="fixed inset-0 z-[120] h-[100dvh] overflow-hidden bg-[#dfe8ef] text-slate-950 dark:text-white">
    <div
      ref={viewportRef}
      className={`absolute inset-0 overflow-hidden bg-[#dfe8ef] touch-none select-none ${engine === "reskonnect" && navigationView !== "street" ? "block" : "hidden"} ${navigationActive ? "top-0" : "top-[58px] sm:top-16"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) => { event.preventDefault(); if (navigationActive) setFollowUser(false); setZoomSafe(zoom + (event.deltaY < 0 ? 1 : -1)); }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#e8eef4_25%,#dce6ee_25%,#dce6ee_50%,#e8eef4_50%,#e8eef4_75%,#dce6ee_75%)] bg-[length:24px_24px]" />
      {tiles.map((tile) => <img
        key={tile.key}
        src={tileUrl(primaryTiles, tile.z, tile.x, tile.y)}
        alt=""
        draggable={false}
        className="pointer-events-none absolute h-64 w-64 max-w-none select-none"
        style={{ left: tile.left, top: tile.top }}
        onLoad={() => setHealth("healthy")}
        onError={(event) => {
          const image = event.currentTarget;
          if (image.dataset.fallback !== "1") {
            image.dataset.fallback = "1";
            image.src = tileUrl(fallbackTiles, tile.z, tile.x, tile.y);
            setHealth("degraded");
            setTileErrors((count) => count + 1);
          } else {
            image.style.display = "none";
            setHealth("degraded");
            setTileErrors((count) => count + 1);
          }
        }}
      />)}

      <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
        {!navigationActive && campusPixel && orbitRadiusPx > 0 && <circle cx={campusPixel.x} cy={campusPixel.y} r={orbitRadiusPx} fill="rgba(124,58,237,.05)" stroke="rgba(124,58,237,.7)" strokeWidth="2" strokeDasharray="7 7" />}
        {userPixel && accuracyRadiusPx > 4 && <circle cx={userPixel.x} cy={userPixel.y} r={accuracyRadiusPx} fill="rgba(37,99,235,.08)" stroke="rgba(37,99,235,.18)" strokeWidth="1" />}
        {routePath && <><path d={routePath} fill="none" stroke="white" strokeWidth={navigationActive ? 12 : 9} strokeLinecap="round" strokeLinejoin="round" opacity=".95" /><path d={routePath} fill="none" stroke="#0f6fff" strokeWidth={navigationActive ? 7 : 5} strokeLinecap="round" strokeLinejoin="round" /></>}
      </svg>

      {!navigationActive && campusMarkers.map(({ campus, x, y }) => <button key={campus.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); chooseCampus(campus.campus_key); }} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-lg ${campus.campus_key === selectedCampusKey ? "h-7 w-7 bg-violet-600" : "h-5 w-5 bg-slate-800"}`} style={{ left: x, top: y }} title={campus.name} />)}

      {!navigationActive && clusters.map((cluster) => {
        if (cluster.type === "cluster") return <button key={cluster.key} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const rows = cluster.items.map((item) => item.row); const fit = fitRows(rows); if (fit) { setCenter(fit.center); setZoom(Math.min(16, zoom + 2)); } }} className="absolute z-20 grid h-10 min-w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border-2 border-white bg-[#0b4a87] px-2 text-xs font-black text-white shadow-xl" style={{ left: cluster.x, top: cluster.y }}>{cluster.items.length}</button>;
        const { row, x, y } = cluster.items[0];
        const price = Number(row.private_price || row.price || row.nsfas_price || 0);
        return <button key={String(row.id)} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); selectResidence(row); }} className="group absolute z-20 -translate-x-1/2 -translate-y-full" style={{ left: x, top: y }} aria-label={`Open ${row.name}`}>
          <span className={`flex h-9 items-center gap-1.5 rounded-2xl border-2 border-white bg-white px-2 text-[10px] font-black shadow-xl transition group-hover:-translate-y-0.5 group-hover:scale-105 ${availabilityTone(row)}`}>
            <span className="grid h-6 w-6 place-items-center rounded-xl bg-blue-50 text-[#0b4a87]"><BedDouble className="h-3.5 w-3.5" /></span>
            {zoom >= 13 && <span className="max-w-[108px] truncate text-slate-900">{price > 0 ? `R${Math.round(price)}` : String(row.name || "Residence")}</span>}
          </span>
          <span className="mx-auto block h-2 w-2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-white bg-white shadow" />
        </button>;
      })}

      {!navigationActive && selectedPixel && <div className="pointer-events-none absolute z-20 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-blue-600 shadow-[0_0_0_8px_rgba(37,99,235,.16)]" style={{ left: selectedPixel.x, top: selectedPixel.y }} />}

      {userPixel && <div className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: userPixel.x, top: userPixel.y }}>
        <div className="absolute left-1/2 top-1/2 h-16 w-11 origin-bottom -translate-x-1/2 -translate-y-full" style={{ transform: `translate(-50%, -100%) rotate(${userHeading || 0}deg)`, transformOrigin: "50% 100%" }}>
          <div className="h-full w-full bg-gradient-to-t from-blue-500/30 to-blue-500/5" style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
        </div>
        <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-blue-500/25" />
        <span className="relative block h-6 w-6 rounded-full border-[4px] border-white bg-blue-600 shadow-xl" />
      </div>}

      <div className="absolute bottom-2 right-2 z-20 rounded bg-white/90 px-2 py-1 text-[9px] font-medium text-slate-700 shadow">© OpenStreetMap contributors · HOT fallback</div>
      {!navigationActive && <div className="absolute bottom-12 right-3 z-20 grid gap-1">
        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setZoomSafe(zoom + 1); }} className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-xl font-black text-slate-900 shadow">+</button>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setZoomSafe(zoom - 1); }} className="grid h-10 w-10 place-items-center rounded-xl border bg-white text-xl font-black text-slate-900 shadow">−</button>
      </div>}
    </div>

    <div ref={streetNode} className={`absolute inset-0 bg-slate-200 ${navigationActive && navigationView === "street" ? "block" : "hidden"}`} />
    <div ref={googleNode} className={`absolute inset-0 bg-[#dfe8ef] ${engine === "google3d" ? "block" : "hidden"} ${navigationActive ? "top-0" : "top-[58px] sm:top-16"}`} />

    {!navigationActive && <>
      <header className="absolute inset-x-0 top-0 z-40 flex h-[58px] items-center justify-between border-b border-white/60 bg-white/95 px-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 sm:h-16 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button onPointerDown={(event) => event.stopPropagation()} onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white dark:bg-slate-900" aria-label="Close ResMap"><X className="h-5 w-5" /></button><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-xl font-black">ResMap</h2><Badge className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">LIVE</Badge></div><p className="hidden truncate text-[11px] text-slate-500 min-[370px]:block">Real accommodation coordinates · {readiness}% geo-ready</p></div></div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {googleReady && <Button variant="outline" size="sm" onClick={() => { const next = engine === "google3d" ? "reskonnect" : "google3d"; setEngine(next); }} className="hidden sm:inline-flex">{engine === "google3d" ? "Street map" : "3D"}</Button>}
          <Button variant="outline" size="icon" onClick={() => void locateMe()} aria-label="Use my live location" className={live.status === "granted" ? "border-blue-300 text-blue-700" : ""}><LocateFixed className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="pointer-events-none absolute left-1/2 top-[66px] z-30 w-[calc(100%-20px)] max-w-3xl -translate-x-1/2 sm:top-[76px] sm:w-[calc(100%-24px)]"><div className="pointer-events-auto rounded-[18px] border border-white/70 bg-white/96 p-1.5 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 sm:rounded-[20px] sm:p-2"><div className="flex gap-1.5 sm:gap-2"><div className="relative min-w-0 flex-1"><Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" /><Input value={aiQuery} onChange={(event) => setAiQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runAiSearch(); }} placeholder="Ask Dimpho for a residence near you…" className="h-10 border-0 bg-slate-50 pl-9 pr-2 text-sm shadow-none dark:bg-slate-900 sm:h-11" /></div><Button className="h-10 shrink-0 rounded-xl px-3 sm:h-11 sm:px-4" onClick={() => void runAiSearch()} disabled={aiLoading}>{aiLoading ? "…" : <><Search className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Search</span></>}</Button></div><p className="mt-1 hidden truncate px-2 text-[10px] text-slate-500 sm:block">{live.status === "granted" ? "Live location is active · nearest results are prioritized on the map" : aiSummary}</p></div></div>

      <aside className="pointer-events-auto absolute left-4 top-[158px] z-30 hidden w-[300px] rounded-[24px] border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 md:block"><Controls /></aside>

      <div className="pointer-events-none absolute right-3 top-[158px] z-30 hidden max-w-[250px] lg:block"><div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/95"><div className="flex items-center gap-2 font-bold"><MapPinned className="h-4 w-4 text-blue-600" />Live spatial inventory</div><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{displayedMapped.length}</p><p className="text-[9px] text-slate-500">ON MAP NOW</p></div><div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{baseMatching.length}</p><p className="text-[9px] text-slate-500">TOTAL MATCHES</p></div></div><div className="mt-2 flex items-center justify-between rounded-xl border px-2 py-1.5"><span className="text-[10px] font-bold uppercase">GPS / map</span><span className={`text-[10px] font-black uppercase ${live.status === "granted" ? "text-emerald-600" : health === "degraded" ? "text-amber-600" : "text-slate-500"}`}>{live.status === "granted" ? `LIVE · ${Math.round(live.position?.accuracy || 0)}m` : health}</span></div>{tileErrors > 0 && engine === "reskonnect" && <p className="mt-2 text-[10px] leading-relaxed text-amber-700">Tile failover active on {tileErrors} request{tileErrors === 1 ? "" : "s"}.</p>}</div></div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 sm:bottom-5 sm:left-auto sm:right-5 sm:w-auto">{selectedResidence && <ResMapResidenceCard residence={selectedResidence} routeInfo={routeInfo} nearby={[]} travelMode={travelMode} onRoute={() => void requestRoute()} onClose={() => { setSelectedResidence(null); setRouteInfo(null); }} />}</div>

      {!selectedResidence && <div className="pointer-events-auto absolute bottom-3 left-3 z-40 md:hidden"><Button className="h-11 rounded-full bg-[#0b4a87] px-4 text-white shadow-xl" onClick={() => setControlsOpen(true)}><SlidersHorizontal className="mr-2 h-4 w-4" />Map controls</Button></div>}
      {controlsOpen && <div className="absolute inset-0 z-50 bg-black/35 md:hidden" onClick={() => setControlsOpen(false)}><div className="absolute inset-x-0 bottom-0 max-h-[76dvh] overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white" onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300" /><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black">ResMap controls</p><p className="text-xs text-slate-500">Orbit, travel time and live filters</p></div><button className="grid h-10 w-10 place-items-center rounded-full border" onClick={() => setControlsOpen(false)}><X className="h-4 w-4" /></button></div><Controls /></div></div>}
      {health === "degraded" && engine === "reskonnect" && <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 hidden w-[calc(100%-24px)] max-w-lg -translate-x-1/2 rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-lg sm:block">A tile provider is slow. ResMap is automatically using the secondary provider.</div>}
      {loading && <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-900 shadow">Syncing live residence inventory…</div>}
    </>}

    {navigationActive && <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-50 p-3 pt-[calc(12px+env(safe-area-inset-top))] sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-[24px] bg-[#076b68]/96 p-3 text-white shadow-2xl backdrop-blur-xl sm:p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/12 sm:h-16 sm:w-16"><ManeuverIcon className="h-8 w-8 sm:h-9 sm:w-9" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/70">{arrived ? "Destination" : nextStep ? humanDistance(nextStep.distance_m) : "Continue"}</p>
            <p className="truncate text-xl font-black sm:text-2xl">{arrived ? `Arrived at ${selectedResidence?.name || "destination"}` : nextStep?.instruction || `Continue to ${selectedResidence?.name || "residence"}`}</p>
            {!arrived && <p className="mt-0.5 truncate text-xs text-white/75">{nextStep?.name || selectedResidence?.canonical_address || selectedResidence?.address || "Live route"}</p>}
          </div>
          <button onClick={() => void endNavigation(arrived ? "completed" : "cancelled")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950/25" aria-label="Exit navigation"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="pointer-events-auto absolute right-3 top-[calc(102px+env(safe-area-inset-top))] z-50 flex flex-col gap-2 sm:right-5 sm:top-[126px]">
        <button onClick={() => { setNavigationView("route"); setEngine("reskonnect"); setFollowUser(true); }} className={`grid h-11 w-11 place-items-center rounded-full border shadow-xl ${navigationView === "route" ? "bg-[#0b4a87] text-white" : "bg-white text-slate-900"}`} aria-label="Route map"><Route className="h-4.5 w-4.5" /></button>
        {googleReady && <button onClick={() => { setNavigationView("street"); setEngine("reskonnect"); }} className={`grid h-11 w-11 place-items-center rounded-full border shadow-xl ${navigationView === "street" ? "bg-[#0b4a87] text-white" : "bg-white text-slate-900"}`} aria-label="Street view"><Eye className="h-4.5 w-4.5" /></button>}
        {googleReady && <button onClick={() => { setNavigationView("3d"); setEngine("google3d"); }} className={`grid h-11 w-11 place-items-center rounded-full border shadow-xl ${navigationView === "3d" ? "bg-[#0b4a87] text-white" : "bg-white text-slate-900"}`} aria-label="Photorealistic 3D"><Building2 className="h-4.5 w-4.5" /></button>}
      </div>

      {navigationView === "route" && <button onClick={() => { setFollowUser(true); if (userLocation) { setCenter(userLocation); setZoom(17); } }} className={`pointer-events-auto absolute bottom-[112px] left-3 z-50 flex h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-bold text-slate-900 shadow-xl sm:bottom-[126px] sm:left-5 ${followUser ? "border-blue-300 text-blue-700" : ""}`}><Navigation className="h-4 w-4" />Re-centre</button>}

      {streetUnavailable && navigationView === "street" && <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/95 p-4 text-center text-sm font-semibold text-slate-900 shadow-2xl">Street imagery is not available at this point. ResMap will keep the live route active.</div>}
      {navigationView === "street" && !streetReady && !streetUnavailable && <div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-slate-900 shadow-xl"><RefreshCw className="mr-2 inline h-4 w-4 animate-spin" />Loading street imagery…</div>}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:p-5">
        <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-3 rounded-[24px] bg-white/96 p-3 text-slate-950 shadow-2xl backdrop-blur-xl sm:p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-2xl font-black sm:text-3xl">{arrived ? "Arrived" : `${Math.max(1, Math.round(remainingDurationS / 60))} min`}</span>{!arrived && <span className="text-blue-600">{travelMode === "walk" ? <Footprints className="h-5 w-5" /> : travelMode === "bike" ? <Bike className="h-5 w-5" /> : travelMode === "transport" ? <Bus className="h-5 w-5" /> : <Car className="h-5 w-5" />}</span>}</div>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{arrived ? selectedResidence?.name : `${humanDistance(remainingDistanceM)} · ETA ${eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</p>
            {!arrived && routeDeviationM > 55 && <p className="mt-1 text-[10px] font-bold text-amber-600">Re-checking your route · {Math.round(routeDeviationM)} m from route line</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            {!arrived && <button onClick={() => { const fit = fitRows(routeCoords.map((coord) => ({ latitude: coord[1], longitude: coord[0] }))); if (fit) { setNavigationView("route"); setEngine("reskonnect"); setFollowUser(false); setCenter(fit.center); setZoom(Math.min(15, Math.max(11, fit.zoom))); } }} className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-900" aria-label="Route overview"><Compass className="h-5 w-5" /></button>}
            <button onClick={() => void endNavigation(arrived ? "completed" : "cancelled")} className={`h-12 rounded-full px-5 text-sm font-black text-white ${arrived ? "bg-emerald-600" : "bg-red-500"}`}>{arrived ? "Done" : "Exit"}</button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-3 top-[calc(166px+env(safe-area-inset-top))] z-40 hidden rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur sm:block">
        {live.status === "granted" ? `GPS ±${Math.round(live.position?.accuracy || 0)} m · heading ${Math.round(userHeading || 0)}°` : "Waiting for live GPS"}
      </div>
    </>}
  </div>;
}
