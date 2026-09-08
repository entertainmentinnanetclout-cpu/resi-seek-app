import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BedSingle, Bike, Bus, Car, CheckCircle2, CircleDollarSign, Footprints, LocateFixed, MapPinned, Search, SlidersHorizontal, Sparkles, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeResidences } from "@/hooks/useRealtimeResidences";
import { isMockResidence, type ResidenceFilters } from "@/hooks/useResidenceFilters";
import { campusFilterValue, circlePolygon, estimateTravelMinutes, haversineKm, parseSpatialIntent, residenceMatchesMapFilters, type TravelMode } from "@/lib/resmap/spatial";
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

interface RouteInfo {
  distance_m: number;
  duration_s: number;
  provider: string;
  profile: TravelMode;
  geometry?: any;
}

type Engine = "reskonnect" | "google3d";
type Health = "starting" | "healthy" | "degraded";

type Center = { latitude: number; longitude: number };
type PointerPoint = { x: number; y: number };

const TILE_SIZE = 256;
const EARTH_RADIUS_M = 6378137;
const SOUTH_AFRICA_CENTER: Center = { latitude: -28.55, longitude: 25.45 };
const OSM_PRIMARY = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_FALLBACK = "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const MERCATOR_MAX_LAT = 85.05112878;

const validCoord = (row: any) =>
  Number.isFinite(Number(row?.latitude)) &&
  Number.isFinite(Number(row?.longitude)) &&
  Number(row.latitude) >= -35.5 && Number(row.latitude) <= -21 &&
  Number(row.longitude) >= 15 && Number(row.longitude) <= 34;

const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const availability = (row: any) => Number(row?.available_spots || 0) > 5 ? "available" : Number(row?.available_spots || 0) > 0 ? "limited" : "unknown";
const availabilityClass = (row: any) => availability(row) === "available" ? "bg-emerald-500" : availability(row) === "limited" ? "bg-amber-500" : "bg-blue-600";

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
  // CARTO raster basemaps require an API key in 2026. Never silently render their
  // key-required/error tiles over a working fallback map.
  if (/cartocdn\.com/i.test(candidate) && !/[?&]key=/i.test(candidate)) return fallback;
  return candidate;
}

function tileUrl(template: string, z: number, x: number, y: number) {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

function worldSize(zoom: number) {
  return TILE_SIZE * Math.pow(2, zoom);
}

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=maps3d`;
    script.onload = () => w.google?.maps?.importLibrary ? resolve(w.google) : reject(new Error("Google Maps did not initialize"));
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    googleLoader = null;
    throw error;
  });
  return googleLoader;
}

export default function ResMapExperienceStable({ filters, updateFilter, resetFilters, onClose }: Props) {
  const { residences, loading } = useRealtimeResidences();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const googleNode = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const dragRef = useRef<{ point: PointerPoint; centerWorld: PointerPoint; zoom: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const initialFitDone = useRef(false);

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
  const [userLocation, setUserLocation] = useState<Center | null>(null);
  const [tileErrors, setTileErrors] = useState(0);

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
  const google3dReady = Boolean(config.google_maps_enabled && config.google_maps_browser_key);
  const selectedCampus = useMemo(() => campuses.find((campus) => campus.campus_key === selectedCampusKey) || null, [campuses, selectedCampusKey]);

  useEffect(() => {
    if (!campuses.length || filters.campus === "all") return;
    const match = campuses.find((campus) => campusMatchesHint(campus, filters.campus));
    if (match && match.campus_key !== selectedCampusKey) setSelectedCampusKey(match.campus_key);
  }, [campuses, filters.campus, selectedCampusKey]);

  const baseMatching = useMemo(() => residences.filter((row: any) => !isMockResidence(row) && row.map_hidden !== true && row.is_visible !== false && residenceMatchesMapFilters(row, filters)), [residences, filters]);
  const mappedMatching = useMemo(() => baseMatching.filter(validCoord), [baseMatching]);
  const displayedMapped = useMemo(() => {
    if (!selectedCampus) return mappedMatching;
    const origin = { latitude: Number(selectedCampus.latitude), longitude: Number(selectedCampus.longitude) };
    return mappedMatching.filter((row: any) => {
      const km = haversineKm(origin, { latitude: Number(row.latitude), longitude: Number(row.longitude) });
      if (orbitRadiusKm > 0 && km > orbitRadiusKm) return false;
      if (travelTimeMax > 0 && estimateTravelMinutes(km, travelMode) > travelTimeMax) return false;
      return true;
    });
  }, [mappedMatching, orbitRadiusKm, selectedCampus, travelMode, travelTimeMax]);

  const allMapped = useMemo(() => residences.filter((row: any) => !isMockResidence(row) && row.map_hidden !== true && row.is_visible !== false && validCoord(row)), [residences]);
  const realCount = useMemo(() => residences.filter((row: any) => !isMockResidence(row)).length, [residences]);
  const readiness = realCount ? Math.round((allMapped.length / realCount) * 100) : 0;

  useEffect(() => {
    if (selectedCampus) {
      setCenter({ latitude: Number(selectedCampus.latitude), longitude: Number(selectedCampus.longitude) });
      setZoom(orbitRadiusKm === 0 ? 11 : orbitRadiusKm <= 0.5 ? 15 : orbitRadiusKm <= 1 ? 14 : orbitRadiusKm <= 2 ? 13 : orbitRadiusKm <= 3 ? 12 : 11);
      return;
    }
    if (initialFitDone.current || !displayedMapped.length) return;
    const fit = fitRows(displayedMapped);
    if (fit) { setCenter(fit.center); setZoom(fit.zoom); initialFitDone.current = true; }
  }, [displayedMapped, orbitRadiusKm, selectedCampus]);

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

  const visibleResidenceMarkers = useMemo(() => displayedMapped.map((row: any) => ({ row, ...toPixel(Number(row.latitude), Number(row.longitude)) })).filter((item) => item.x > -80 && item.x < viewport.width + 80 && item.y > -80 && item.y < viewport.height + 80), [displayedMapped, toPixel, viewport.height, viewport.width]);
  const campusMarkers = useMemo(() => campuses.map((campus) => ({ campus, ...toPixel(Number(campus.latitude), Number(campus.longitude)) })).filter((item) => item.x > -80 && item.x < viewport.width + 80 && item.y > -80 && item.y < viewport.height + 80), [campuses, toPixel, viewport.height, viewport.width]);
  const selectedPixel = selectedResidence && validCoord(selectedResidence) ? toPixel(Number(selectedResidence.latitude), Number(selectedResidence.longitude)) : null;
  const userPixel = userLocation ? toPixel(userLocation.latitude, userLocation.longitude) : null;
  const campusPixel = selectedCampus ? toPixel(Number(selectedCampus.latitude), Number(selectedCampus.longitude)) : null;
  const orbitRadiusPx = selectedCampus && orbitRadiusKm > 0 ? (orbitRadiusKm * 1000) / Math.max(0.01, metersPerPixel(Number(selectedCampus.latitude), zoom)) : 0;

  const routePath = useMemo(() => {
    const coords = routeInfo?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return "";
    return coords.map((coord: number[], index: number) => {
      const point = toPixel(Number(coord[1]), Number(coord[0]));
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(" ");
  }, [routeInfo, toPixel]);

  const setZoomSafe = (next: number) => setZoom(clamp(Math.round(next), 3, 19));

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      dragRef.current = { point: { x: event.clientX, y: event.clientY }, centerWorld: project(center.latitude, center.longitude, zoom), zoom };
      pinchRef.current = null;
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
      const ratio = distance / Math.max(1, pinchRef.current.distance);
      const next = pinchRef.current.zoom + Math.log2(ratio);
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
    setSelectedResidence(row);
    setRouteInfo(null);
    setCenter({ latitude: Number(row.latitude), longitude: Number(row.longitude) });
    setZoom((current) => Math.max(15, current));
    if (engine === "google3d" && googleMapRef.current) {
      googleMapRef.current.center = { lat: Number(row.latitude), lng: Number(row.longitude), altitude: 0 };
      googleMapRef.current.range = 1000;
      googleMapRef.current.tilt = 67.5;
    }
  };

  useEffect(() => {
    if (engine !== "google3d" || !googleNode.current || !google3dReady || !config.google_maps_browser_key) return;
    let disposed = false;
    setHealth("starting");
    loadGoogleMaps(config.google_maps_browser_key).then(async (google) => {
      const { Map3DElement } = await google.maps.importLibrary("maps3d");
      if (disposed || !googleNode.current) return;
      const map3d = new Map3DElement({
        center: { lat: center.latitude, lng: center.longitude, altitude: 0 },
        tilt: 67.5,
        heading: 0,
        range: zoom >= 15 ? 1600 : zoom >= 12 ? 8000 : 220000,
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
      toast.error("Photorealistic 3D could not initialize. ResMap returned to the live street map.");
      setEngine("reskonnect");
      setHealth("degraded");
    });
    return () => {
      disposed = true;
      googleMarkersRef.current.forEach((marker) => { try { marker.remove(); } catch { /* no-op */ } });
      googleMarkersRef.current = [];
      if (googleNode.current) googleNode.current.replaceChildren();
      googleMapRef.current = null;
    };
  }, [config.google_maps_browser_key, config.google_maps_map_id, config.google_maps_mode, center.latitude, center.longitude, engine, google3dReady, zoom]);

  useEffect(() => {
    if (engine !== "google3d" || !googleMapRef.current || !google3dReady) return;
    let active = true;
    (async () => {
      try {
        const google = (window as any).google;
        const { Marker3DInteractiveElement } = await google.maps.importLibrary("maps3d");
        if (!active || !googleMapRef.current) return;
        googleMarkersRef.current.forEach((marker) => { try { marker.remove(); } catch { /* no-op */ } });
        googleMarkersRef.current = displayedMapped.map((row: any) => {
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
        console.warn("Google 3D markers failed", error);
      }
    })();
    return () => { active = false; };
  }, [displayedMapped, engine, google3dReady]);

  const chooseCampus = (campusKey: string) => {
    setSelectedCampusKey(campusKey);
    const campus = campuses.find((row) => row.campus_key === campusKey);
    updateFilter("campus", campus ? campusFilterValue(campus) : "all");
    setSelectedResidence(null);
    setRouteInfo(null);
    if (campus) {
      const next = { latitude: Number(campus.latitude), longitude: Number(campus.longitude) };
      setCenter(next);
      setZoom(12);
      if (engine === "google3d" && googleMapRef.current) {
        googleMapRef.current.center = { lat: next.latitude, lng: next.longitude, altitude: 0 };
        googleMapRef.current.range = 6500;
      }
    }
  };

  const locateMe = () => {
    if (!navigator.geolocation) { toast.error("Location is not available on this device"); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(next);
      setCenter(next);
      setZoom(15);
      if (engine === "google3d" && googleMapRef.current) {
        googleMapRef.current.center = { lat: next.latitude, lng: next.longitude, altitude: 0 };
        googleMapRef.current.range = 1800;
      }
      toast.success("ResMap centered on your current location");
    }, () => toast.error("Location permission was not granted"), { enableHighAccuracy: true, timeout: 9000, maximumAge: 15000 });
  };

  const requestRoute = async () => {
    if (!selectedResidence || !validCoord(selectedResidence)) return;
    const origin = selectedCampus
      ? { lat: Number(selectedCampus.latitude), lng: Number(selectedCampus.longitude) }
      : userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null;
    if (!origin) { toast.info("Choose a campus or tap Locate me first so ResMap knows where the journey starts."); return; }
    toast.loading("Building your live route…", { id: "resmap-route" });
    const destination = { lat: Number(selectedResidence.latitude), lng: Number(selectedResidence.longitude) };
    const { data, error } = await supabase.functions.invoke("resmap-spatial", { body: { action: "route", origin, destination, profile: travelMode } });
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Could not build route", { id: "resmap-route" }); return; }
    const info: RouteInfo = { distance_m: Number(data.distance_m), duration_s: Number(data.duration_s), provider: String(data.provider), profile: travelMode, geometry: data.geometry };
    setRouteInfo(info);
    if (engine === "reskonnect" && Array.isArray(data.geometry?.coordinates) && data.geometry.coordinates.length) {
      const rows = data.geometry.coordinates.map((coord: number[]) => ({ latitude: Number(coord[1]), longitude: Number(coord[0]) }));
      const fit = fitRows(rows);
      if (fit) { setCenter(fit.center); setZoom(Math.min(15, Math.max(11, fit.zoom))); }
    }
    toast.success(`${Math.max(1, Math.round(info.duration_s / 60))} min · ${(info.distance_m / 1000).toFixed(1)} km`, { id: "resmap-route" });
  };

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
    { mode: "walk", label: "Walk", icon: Footprints }, { mode: "bike", label: "Bike", icon: Bike }, { mode: "drive", label: "Drive", icon: Car }, { mode: "transport", label: "Transport", icon: Bus },
  ];

  const Controls = () => <div className="space-y-4">
    <div>
      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.16em] text-slate-500">Campus orbit</p><Badge variant="outline">{displayedMapped.length} mapped</Badge></div>
      <select value={selectedCampusKey} onChange={(event) => chooseCampus(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-900 outline-none dark:bg-slate-900 dark:text-white">
        <option value="">All mapped areas</option>{campuses.map((campus) => <option key={campus.id} value={campus.campus_key}>{campus.name}</option>)}
      </select>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{[0, 0.5, 1, 2, 3, 5].map((radius) => <button key={radius} onClick={() => setOrbitRadiusKm(radius)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${orbitRadiusKm === radius ? "bg-violet-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>{radius === 0 ? "Any" : `${radius} km`}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">Travel-time search</p>
      <div className="grid grid-cols-4 gap-1.5">{modes.map(({ mode, label, icon: Icon }) => <button key={mode} onClick={() => setTravelMode(mode)} className={`rounded-xl px-1 py-2 text-[10px] font-bold ${travelMode === mode ? "bg-[#07192e] text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{[0, 10, 15, 20, 30, 45].map((minutes) => <button key={minutes} onClick={() => setTravelTimeMax(minutes)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${travelTimeMax === minutes ? "bg-cyan-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>{minutes === 0 ? "Any time" : `≤ ${minutes} min`}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">Live filters</p>
      <div className="flex flex-wrap gap-1.5">{quickFilters.map(({ label, active, icon: Icon, action }) => <button key={label} onClick={action} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-blue-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}><Icon className="mr-1 inline h-3.5 w-3.5" />{label}</button>)}</div>
      <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">Max rent: R{filters.priceMax.toLocaleString("en-ZA")}</label>
      <input type="range" min={1500} max={10000} step={250} value={filters.priceMax} onChange={(event) => updateFilter("priceMax", Number(event.target.value))} className="mt-1 w-full accent-blue-600" />
      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { resetFilters(); setSelectedCampusKey(""); setTravelTimeMax(0); setOrbitRadiusKm(3); setSelectedResidence(null); setRouteInfo(null); initialFitDone.current = false; }}>Reset map search</Button>
    </div>
  </div>;

  return <div className="fixed inset-0 z-[120] overflow-hidden bg-[#dfe8ef] text-slate-950 dark:text-white">
    <div
      ref={viewportRef}
      className={`absolute inset-x-0 bottom-0 top-16 overflow-hidden bg-[#dfe8ef] touch-none select-none ${engine === "reskonnect" ? "block" : "hidden"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={(event) => { event.preventDefault(); setZoomSafe(zoom + (event.deltaY < 0 ? 1 : -1)); }}
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
        {campusPixel && orbitRadiusPx > 0 && <><circle cx={campusPixel.x} cy={campusPixel.y} r={orbitRadiusPx} fill="rgba(124,58,237,.05)" stroke="rgba(124,58,237,.7)" strokeWidth="2" strokeDasharray="7 7" /></>}
        {routePath && <><path d={routePath} fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity=".9" /><path d={routePath} fill="none" stroke="#0f6fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></>}
      </svg>

      {campusMarkers.map(({ campus, x, y }) => <button key={campus.id} onClick={(event) => { event.stopPropagation(); chooseCampus(campus.campus_key); }} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg ${campus.campus_key === selectedCampusKey ? "h-6 w-6 bg-violet-600" : "h-4 w-4 bg-slate-900"}`} style={{ left: x, top: y }} title={campus.name} />)}

      {visibleResidenceMarkers.map(({ row, x, y }) => {
        const price = Number(row.private_price || row.price || row.nsfas_price || 0);
        return <button key={String(row.id)} onClick={(event) => { event.stopPropagation(); selectResidence(row); }} className="group absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }} aria-label={`Open ${row.name}`}>
          <span className={`block rounded-full border-2 border-white shadow-lg transition group-hover:scale-125 ${zoom >= 14 ? "h-5 w-5" : "h-3.5 w-3.5"} ${availabilityClass(row)}`} />
          {zoom >= 13 && <span className="mt-1 block max-w-[120px] truncate rounded-full border bg-white/95 px-2 py-0.5 text-[10px] font-black text-slate-900 shadow">{price > 0 ? `R${Math.round(price)}` : row.name}</span>}
        </button>;
      })}

      {selectedPixel && <div className="pointer-events-none absolute z-20 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-blue-600 shadow-[0_0_0_7px_rgba(37,99,235,.16)]" style={{ left: selectedPixel.x, top: selectedPixel.y }} />}
      {userPixel && <div className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-slate-900 shadow-lg" style={{ left: userPixel.x, top: userPixel.y }} />}

      <div className="absolute bottom-2 right-2 z-20 rounded bg-white/90 px-2 py-1 text-[9px] font-medium text-slate-700 shadow">© OpenStreetMap contributors · HOT fallback</div>
      <div className="absolute bottom-12 right-3 z-20 grid gap-1">
        <button onClick={(event) => { event.stopPropagation(); setZoomSafe(zoom + 1); }} className="grid h-9 w-9 place-items-center rounded-lg border bg-white text-xl font-black text-slate-900 shadow">+</button>
        <button onClick={(event) => { event.stopPropagation(); setZoomSafe(zoom - 1); }} className="grid h-9 w-9 place-items-center rounded-lg border bg-white text-xl font-black text-slate-900 shadow">−</button>
      </div>
    </div>

    <div ref={googleNode} className={`absolute inset-x-0 bottom-0 top-16 bg-[#dfe8ef] ${engine === "google3d" ? "block" : "hidden"}`} />

    <header className="absolute inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/60 bg-white/95 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white dark:bg-slate-900" aria-label="Close ResMap"><X className="h-5 w-5" /></button><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-lg font-black sm:text-xl">ResMap</h2><Badge className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">LIVE</Badge><Badge variant="outline" className="hidden sm:inline-flex">{engine === "google3d" ? "Photorealistic 3D" : "Street map"}</Badge></div><p className="truncate text-[11px] text-slate-500">Real accommodation coordinates · {readiness}% geo-ready · no generated building twins</p></div></div>
      <div className="flex items-center gap-2">
        {google3dReady ? <Button variant="outline" size="sm" onClick={() => setEngine((current) => current === "google3d" ? "reskonnect" : "google3d")}>{engine === "google3d" ? "Street map" : "Photorealistic 3D"}</Button> : <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">3D provider not connected</Badge>}
        <Button variant="outline" size="icon" onClick={locateMe} aria-label="Use my location"><LocateFixed className="h-4 w-4" /></Button>
      </div>
    </header>

    <div className="pointer-events-none absolute left-1/2 top-[76px] z-30 w-[calc(100%-24px)] max-w-2xl -translate-x-1/2"><div className="pointer-events-auto rounded-[20px] border border-white/70 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95"><div className="flex gap-2"><div className="relative flex-1"><Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" /><Input value={aiQuery} onChange={(event) => setAiQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runAiSearch(); }} placeholder='Ask Dimpho: “NSFAS single room within 15 min walk of Soshanguve North”' className="h-11 border-0 bg-slate-50 pl-9 text-sm shadow-none dark:bg-slate-900" /></div><Button className="h-11 shrink-0" onClick={() => void runAiSearch()} disabled={aiLoading}>{aiLoading ? "Thinking…" : <><Search className="mr-1.5 h-4 w-4" />Search</>}</Button></div><p className="mt-1.5 truncate px-2 text-[10px] text-slate-500">{aiSummary}</p></div></div>

    <aside className="pointer-events-auto absolute left-4 top-[158px] z-30 hidden w-[300px] rounded-[24px] border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 md:block"><Controls /></aside>

    <div className="pointer-events-none absolute right-3 top-[158px] z-30 hidden max-w-[250px] lg:block"><div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/95"><div className="flex items-center gap-2 font-bold"><MapPinned className="h-4 w-4 text-blue-600" />Live spatial inventory</div><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{displayedMapped.length}</p><p className="text-[9px] text-slate-500">ON MAP NOW</p></div><div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{baseMatching.length}</p><p className="text-[9px] text-slate-500">TOTAL MATCHES</p></div></div><div className="mt-2 flex items-center justify-between rounded-xl border px-2 py-1.5"><span className="text-[10px] font-bold uppercase">Map health</span><span className={`text-[10px] font-black uppercase ${health === "healthy" ? "text-emerald-600" : health === "degraded" ? "text-amber-600" : "text-slate-500"}`}>{health}</span></div>{tileErrors > 0 && engine === "reskonnect" && <p className="mt-2 text-[10px] leading-relaxed text-amber-700">Primary tiles failed {tileErrors} time{tileErrors === 1 ? "" : "s"}; affected tiles automatically retry against the secondary provider.</p>}</div></div>

    <div className="pointer-events-none absolute bottom-3 right-3 z-40 w-[calc(100%-24px)] sm:bottom-5 sm:right-5 sm:w-auto">{selectedResidence && <ResMapResidenceCard residence={selectedResidence} routeInfo={routeInfo} nearby={[]} travelMode={travelMode} onRoute={() => void requestRoute()} onClose={() => { setSelectedResidence(null); setRouteInfo(null); }} />}</div>

    <div className="pointer-events-auto absolute bottom-3 left-3 z-40 md:hidden"><Button className="rounded-full shadow-xl" onClick={() => setControlsOpen(true)}><SlidersHorizontal className="mr-2 h-4 w-4" />Map controls</Button></div>
    {controlsOpen && <div className="absolute inset-0 z-50 bg-black/30 md:hidden" onClick={() => setControlsOpen(false)}><div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black">ResMap controls</p><p className="text-xs text-slate-500">Campus orbit, travel time and live accommodation filters</p></div><button className="grid h-9 w-9 place-items-center rounded-full border" onClick={() => setControlsOpen(false)}><X className="h-4 w-4" /></button></div><Controls /></div></div>}
    {health === "degraded" && engine === "reskonnect" && <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 w-[calc(100%-24px)] max-w-lg -translate-x-1/2 rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-lg">A map tile provider is unavailable. ResMap is retrying the secondary provider instead of leaving a blank canvas.</div>}
    {loading && <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-900 shadow">Syncing live residence inventory…</div>}
  </div>;
}
