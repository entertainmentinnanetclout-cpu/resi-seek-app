import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bike,
  Bus,
  Car,
  CheckCircle2,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Eye,
  Footprints,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Sparkles,
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
  estimateTravelMinutes,
  haversineKm,
  parseSpatialIntent,
  residenceMatchesMapFilters,
  type TravelMode,
} from "@/lib/resmap/spatial";
import ResMapResidenceCard from "./ResMapResidenceCard";
import ResMapExperiencePremium from "./ResMapExperiencePremium";

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
  latitude: number;
  longitude: number;
}

interface MapConfig {
  google_maps_enabled: boolean;
  google_maps_browser_key?: string | null;
  google_maps_map_id?: string | null;
  google_maps_mode?: "ROADMAP" | "SATELLITE" | "HYBRID";
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

type Center = { latitude: number; longitude: number };
type NavigationView = "route" | "street";

type RouteSnap = {
  segmentIndex: number;
  t: number;
  point: Center;
  distanceM: number;
  progressM: number;
  heading: number;
};

const SOUTH_AFRICA_CENTER = { lat: -28.55, lng: 25.45 };
const NAV_LOCAL_KEY = "reskonnect_resmap_active_navigation_v4";
const MAX_ROUTE_AGE_MS = 6 * 60 * 60 * 1000;

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
      if (w.google?.maps?.importLibrary) return resolve(w.google);
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

const validCoord = (row: any) =>
  Number.isFinite(Number(row?.latitude)) &&
  Number.isFinite(Number(row?.longitude)) &&
  Number(row.latitude) >= -35.5 &&
  Number(row.latitude) <= -21 &&
  Number(row.longitude) >= 15 &&
  Number(row.longitude) <= 34;

const centerOf = (row: any): Center => ({
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
});

const money = (row: any) => {
  const value = row.accepts_nsfas && Number(row.nsfas_price) > 0
    ? Number(row.nsfas_price)
    : Number(row.private_price || row.price || 0);
  return value > 0 ? `R${Math.round(value).toLocaleString("en-ZA")}` : "";
};

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

function snapToRoute(
  point: Center,
  coords: number[][],
  cumulative: number[],
  previousProgressM: number,
): RouteSnap | null {
  if (coords.length < 2) return null;
  let best: RouteSnap | null = null;
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = { latitude: Number(coords[i][1]), longitude: Number(coords[i][0]) };
    const b = { latitude: Number(coords[i + 1][1]), longitude: Number(coords[i + 1][0]) };
    const projected = projectToSegment(point, a, b);
    const segmentLength = Math.max(0, (cumulative[i + 1] || 0) - (cumulative[i] || 0));
    const progressM = (cumulative[i] || 0) + segmentLength * projected.t;
    const backwards = previousProgressM - progressM;
    if (previousProgressM > 0 && backwards > 45) continue;
    const candidate: RouteSnap = {
      segmentIndex: i,
      t: projected.t,
      point: projected.point,
      distanceM: projected.distanceM,
      progressM,
      heading: bearingBetween(a, b),
    };
    if (!best || candidate.distanceM < best.distanceM) best = candidate;
  }

  if (!best) {
    for (let i = 0; i < coords.length - 1; i += 1) {
      const a = { latitude: Number(coords[i][1]), longitude: Number(coords[i][0]) };
      const b = { latitude: Number(coords[i + 1][1]), longitude: Number(coords[i + 1][0]) };
      const projected = projectToSegment(point, a, b);
      const segmentLength = Math.max(0, (cumulative[i + 1] || 0) - (cumulative[i] || 0));
      const candidate: RouteSnap = {
        segmentIndex: i,
        t: projected.t,
        point: projected.point,
        distanceM: projected.distanceM,
        progressM: (cumulative[i] || 0) + segmentLength * projected.t,
        heading: bearingBetween(a, b),
      };
      if (!best || candidate.distanceM < best.distanceM) best = candidate;
    }
  }
  return best;
}

function pointAlongRoute(coords: number[][], cumulative: number[], progressM: number): Center | null {
  if (coords.length < 2) return null;
  const total = cumulative[cumulative.length - 1] || 0;
  const target = Math.max(0, Math.min(total, progressM));
  for (let i = 0; i < coords.length - 1; i += 1) {
    const start = cumulative[i] || 0;
    const end = cumulative[i + 1] || start;
    if (target <= end) {
      const ratio = end > start ? (target - start) / (end - start) : 0;
      return {
        latitude: Number(coords[i][1]) + (Number(coords[i + 1][1]) - Number(coords[i][1])) * ratio,
        longitude: Number(coords[i][0]) + (Number(coords[i + 1][0]) - Number(coords[i][0])) * ratio,
      };
    }
  }
  const last = coords[coords.length - 1];
  return { latitude: Number(last?.[1]), longitude: Number(last?.[0]) };
}

function humanDistance(meters: number) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 950) return `${Math.max(5, Math.round(meters / 5) * 5)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function maneuverIcon(step?: RouteStep | null) {
  const modifier = String(step?.modifier || "").toLowerCase();
  const type = String(step?.type || "").toLowerCase();
  if (type.includes("arrive")) return MapPin;
  if (modifier.includes("left")) return modifier.includes("slight") ? ArrowLeft : CornerUpLeft;
  if (modifier.includes("right")) return modifier.includes("slight") ? ArrowRight : CornerUpRight;
  return ArrowUp;
}

function bedMarkerSvg(selected = false) {
  const bg = selected ? "#0b3d70" : "#ffffff";
  const fg = selected ? "#ffffff" : "#0b3d70";
  const border = selected ? "#ffffff" : "#0b3d70";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><circle cx="21" cy="21" r="19" fill="${bg}" stroke="${border}" stroke-width="3"/><path fill="${fg}" d="M10 16h6a4 4 0 0 1 4 4v2h12v-5a2 2 0 0 1 4 0v14h-4v-3H10v3H6V15a2 2 0 0 1 4 0v1Zm2 2v4h6v-2a2 2 0 0 0-2-2h-4Z"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function destinationSvg(arrived = false) {
  const fill = arrived ? "#059669" : "#e11d48";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="62" viewBox="0 0 52 62"><path d="M26 2C12.7 2 2 12.7 2 26c0 17.3 24 34 24 34s24-16.7 24-34C50 12.7 39.3 2 26 2Z" fill="${fill}" stroke="white" stroke-width="4"/><circle cx="26" cy="26" r="10" fill="white"/><path d="M20 23h4a3 3 0 0 1 3 3v1h7v-3a2 2 0 1 1 4 0v9h-4v-2H20v2h-4V22a2 2 0 1 1 4 0v1Z" fill="${fill}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function userArrowSvg(heading: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="54" height="54" viewBox="0 0 54 54"><circle cx="27" cy="27" r="12" fill="#2563eb" stroke="white" stroke-width="4"/><g transform="rotate(${heading} 27 27)"><path d="M27 2 36 20 27 17 18 20Z" fill="#2563eb" stroke="white" stroke-width="2"/></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function ResMapExperiencePremiumV2({ filters, updateFilter, resetFilters, onClose }: Props) {
  const { user } = useAuth();
  const live = useLiveLocation();
  const { residences, loading } = useRealtimeResidences();

  const mapNode = useRef<HTMLDivElement | null>(null);
  const streetNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const googleRef = useRef<any>(null);
  const residenceMarkersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const pulseCircleRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const panoramaRef = useRef<any>(null);
  const streetServiceRef = useRef<any>(null);
  const streetDestinationMarkerRef = useRef<any>(null);
  const streetLastPanoPointRef = useRef<Center | null>(null);
  const streetLastPanoAtRef = useRef(0);
  const progressRef = useRef(0);
  const snapRef = useRef<RouteSnap | null>(null);
  const destinationRef = useRef<any | null>(null);
  const lastRerouteRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const lastSessionSyncRef = useRef(0);
  const lastLocalSyncRef = useRef(0);
  const pulseTimerRef = useRef<number | null>(null);

  // Start in a neutral loading state. The live config arrives immediately from Supabase;
  // using true here prevents the legacy fallback from winning a race before that fetch resolves.
  const [config, setConfig] = useState<MapConfig>({ google_maps_enabled: true });
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [googleStatus, setGoogleStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [mapZoom, setMapZoom] = useState(11);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("walk");
  const [selectedCampusKey, setSelectedCampusKey] = useState("");
  const [orbitRadiusKm, setOrbitRadiusKm] = useState(0);
  const [travelTimeMax, setTravelTimeMax] = useState(0);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiSummary, setAiSummary] = useState("Ask Dimpho to reshape the map around your live location.");
  const [aiLoading, setAiLoading] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [navigationView, setNavigationView] = useState<NavigationView>("route");
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentProgressM, setCurrentProgressM] = useState(0);
  const [remainingDistanceM, setRemainingDistanceM] = useState(0);
  const [remainingDurationS, setRemainingDurationS] = useState(0);
  const [routeDeviationM, setRouteDeviationM] = useState(0);
  const [routeHeading, setRouteHeading] = useState<number | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [streetReady, setStreetReady] = useState(false);
  const [streetUnavailable, setStreetUnavailable] = useState(false);
  const [arrived, setArrived] = useState(false);

  const userLocation = useMemo(
    () => live.position ? { latitude: live.position.latitude, longitude: live.position.longitude } : null,
    [live.position?.latitude, live.position?.longitude],
  );

  const selectedCampus = useMemo(
    () => campuses.find((row) => row.campus_key === selectedCampusKey) || null,
    [campuses, selectedCampusKey],
  );

  const mappedMatching = useMemo(
    () => residences.filter((row: any) =>
      !isMockResidence(row) &&
      row.map_hidden !== true &&
      row.is_visible !== false &&
      validCoord(row) &&
      residenceMatchesMapFilters(row, filters),
    ),
    [filters, residences],
  );

  const displayedMapped = useMemo(() => {
    let rows = mappedMatching;
    if (selectedCampus) {
      const origin = { latitude: selectedCampus.latitude, longitude: selectedCampus.longitude };
      rows = rows.filter((row: any) => {
        const km = haversineKm(origin, centerOf(row));
        if (orbitRadiusKm > 0 && km > orbitRadiusKm) return false;
        if (travelTimeMax > 0 && estimateTravelMinutes(km, travelMode) > travelTimeMax) return false;
        return true;
      });
    }
    if (!selectedCampus && userLocation) {
      rows = [...rows].sort((a, b) =>
        liveDistanceKm(userLocation, centerOf(a)) - liveDistanceKm(userLocation, centerOf(b)),
      );
    }
    return rows;
  }, [mappedMatching, orbitRadiusKm, selectedCampus, travelMode, travelTimeMax, userLocation?.latitude, userLocation?.longitude]);

  const routeCoords = useMemo(
    () => Array.isArray(routeInfo?.geometry?.coordinates) ? routeInfo!.geometry!.coordinates! : [],
    [routeInfo],
  );
  const routeMetrics = useMemo(() => routeCumulative(routeCoords), [routeCoords]);

  const stepProgresses = useMemo(() => {
    if (!routeInfo?.steps?.length || routeCoords.length < 2) return [] as number[];
    return routeInfo.steps.map((step) => {
      const snap = snapToRoute(
        { latitude: step.location.lat, longitude: step.location.lng },
        routeCoords,
        routeMetrics.cumulative,
        0,
      );
      return snap?.progressM ?? 0;
    });
  }, [routeCoords, routeInfo?.steps, routeMetrics.cumulative]);

  const currentStep = routeInfo?.steps?.[currentStepIndex] || null;
  const nextManeuverDistanceM = currentStep
    ? Math.max(0, (stepProgresses[currentStepIndex] ?? currentProgressM) - currentProgressM)
    : remainingDistanceM;
  const ManeuverIcon = maneuverIcon(currentStep);

  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [configRes, campusRes] = await Promise.all([
        (supabase as any).from("resmap_map_config")
          .select("google_maps_enabled,google_maps_browser_key,google_maps_map_id,google_maps_mode")
          .eq("id", 1).maybeSingle(),
        (supabase as any).from("resmap_campuses")
          .select("id,campus_key,name,short_name,aliases,latitude,longitude")
          .eq("is_active", true).order("name"),
      ]);
      if (!active) return;
      if (configRes.data) setConfig(configRes.data as MapConfig);
      else setGoogleStatus("failed");
      setCampuses((campusRes.data || []).filter((row: any) => validCoord(row)) as Campus[]);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!config.google_maps_enabled || !config.google_maps_browser_key || !mapNode.current) {
      if (config.google_maps_enabled === false) setGoogleStatus("failed");
      return;
    }
    let disposed = false;
    loadGoogleMaps(config.google_maps_browser_key).then(async (google) => {
      await google.maps.importLibrary("maps");
      await google.maps.importLibrary("marker").catch(() => null);
      if (disposed || !mapNode.current) return;
      googleRef.current = google;
      const initial = userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : SOUTH_AFRICA_CENTER;
      const map = new google.maps.Map(mapNode.current, {
        center: initial,
        zoom: userLocation ? 15 : 7,
        disableDefaultUI: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        keyboardShortcuts: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        ...(config.google_maps_map_id ? { mapId: config.google_maps_map_id } : {}),
      });
      mapRef.current = map;
      setMapZoom(map.getZoom() || 11);
      map.addListener("zoom_changed", () => setMapZoom(map.getZoom() || 11));
      map.addListener("dragstart", () => setFollowUser(false));
      setGoogleStatus("ready");
    }).catch((error) => {
      console.error("ResMap Google map failed", error);
      setGoogleStatus("failed");
    });
    return () => {
      disposed = true;
      if (pulseTimerRef.current != null) window.clearInterval(pulseTimerRef.current);
      pulseTimerRef.current = null;
      mapRef.current = null;
      googleRef.current = null;
    };
  }, [config.google_maps_browser_key, config.google_maps_enabled, config.google_maps_map_id]);

  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || googleStatus !== "ready" || navigationActive) return;

    residenceMarkersRef.current.forEach((marker) => marker.setMap?.(null));
    residenceMarkersRef.current = [];

    const zoom = map.getZoom() || mapZoom;
    const maxMarkers = zoom < 11 ? 90 : zoom < 13 ? 180 : 360;
    const rows = displayedMapped.slice(0, maxMarkers);
    residenceMarkersRef.current = rows.map((row: any) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: Number(row.latitude), lng: Number(row.longitude) },
        title: String(row.name || "Residence"),
        icon: {
          url: bedMarkerSvg(selectedResidence?.id === row.id),
          scaledSize: new google.maps.Size(38, 38),
          anchor: new google.maps.Point(19, 19),
        },
        label: zoom >= 14 && money(row)
          ? { text: money(row), color: "#0f172a", fontSize: "11px", fontWeight: "800", className: "resmap-price-label" }
          : undefined,
        optimized: true,
      });
      marker.addListener("click", () => {
        setSelectedResidence(row);
        map.panTo({ lat: Number(row.latitude), lng: Number(row.longitude) });
        if ((map.getZoom() || 0) < 16) map.setZoom(16);
      });
      return marker;
    });
  }, [displayedMapped, googleStatus, mapZoom, navigationActive, selectedResidence?.id]);

  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || googleStatus !== "ready" || !live.position) return;
    const pos = { lat: live.position.latitude, lng: live.position.longitude };
    const heading = navigationActive
      ? (routeHeading ?? live.effectiveHeading ?? 0)
      : (live.effectiveHeading ?? 0);

    if (!userMarkerRef.current) {
      userMarkerRef.current = new google.maps.Marker({
        map,
        position: pos,
        zIndex: 999,
        title: "Your live location",
        icon: {
          url: userArrowSvg(heading),
          scaledSize: new google.maps.Size(54, 54),
          anchor: new google.maps.Point(27, 27),
        },
      });
      accuracyCircleRef.current = new google.maps.Circle({
        map,
        center: pos,
        radius: Math.max(8, live.position.accuracy),
        strokeColor: "#2563eb",
        strokeOpacity: 0.28,
        strokeWeight: 1,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
      });
      pulseCircleRef.current = new google.maps.Circle({
        map,
        center: pos,
        radius: 12,
        strokeColor: "#2563eb",
        strokeOpacity: 0.5,
        strokeWeight: 2,
        fillColor: "#2563eb",
        fillOpacity: 0.05,
      });
      let grow = true;
      pulseTimerRef.current = window.setInterval(() => {
        const circle = pulseCircleRef.current;
        if (!circle) return;
        const current = Number(circle.getRadius?.() || 12);
        const next = grow ? current + 2 : current - 2;
        if (next >= 28) grow = false;
        if (next <= 12) grow = true;
        circle.setRadius(Math.max(12, Math.min(28, next)));
      }, 120);
    } else {
      userMarkerRef.current.setPosition(pos);
      userMarkerRef.current.setIcon({
        url: userArrowSvg(heading),
        scaledSize: new google.maps.Size(54, 54),
        anchor: new google.maps.Point(27, 27),
      });
      accuracyCircleRef.current?.setCenter(pos);
      accuracyCircleRef.current?.setRadius(Math.max(8, live.position.accuracy));
      pulseCircleRef.current?.setCenter(pos);
    }

    if (navigationActive && followUser && navigationView === "route") {
      map.panTo(pos);
      if ((map.getZoom() || 0) < 18) map.setZoom(18);
      try { map.setHeading(routeHeading ?? live.effectiveHeading ?? 0); } catch { /* vector heading is optional */ }
    }
  }, [followUser, googleStatus, live.effectiveHeading, live.position, navigationActive, navigationView, routeHeading]);

  useEffect(() => {
    const google = googleRef.current;
    const map = mapRef.current;
    if (!google || !map || !navigationActive || !selectedResidence || !validCoord(selectedResidence)) return;

    residenceMarkersRef.current.forEach((marker) => marker.setMap?.(null));
    residenceMarkersRef.current = [];
    const destination = { lat: Number(selectedResidence.latitude), lng: Number(selectedResidence.longitude) };
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new google.maps.Marker({
        map,
        position: destination,
        title: selectedResidence.name || "Destination",
        zIndex: 1000,
        icon: {
          url: destinationSvg(arrived),
          scaledSize: new google.maps.Size(48, 58),
          anchor: new google.maps.Point(24, 56),
        },
      });
    } else {
      destinationMarkerRef.current.setMap(map);
      destinationMarkerRef.current.setPosition(destination);
      destinationMarkerRef.current.setIcon({
        url: destinationSvg(arrived),
        scaledSize: new google.maps.Size(48, 58),
        anchor: new google.maps.Point(24, 56),
      });
    }

    routePolylineRef.current?.setMap?.(null);
    if (routeCoords.length > 1) {
      routePolylineRef.current = new google.maps.Polyline({
        map,
        path: routeCoords.map((coord) => ({ lat: Number(coord[1]), lng: Number(coord[0]) })),
        strokeColor: "#2563eb",
        strokeOpacity: 0.95,
        strokeWeight: 7,
        geodesic: true,
        zIndex: 20,
      });
    }
  }, [arrived, navigationActive, routeCoords, selectedResidence]);

  const persistLocal = useCallback(() => {
    if (!navigationActive || !selectedResidence || !routeInfo) return;
    const now = Date.now();
    if (now - lastLocalSyncRef.current < 2000) return;
    lastLocalSyncRef.current = now;
    try {
      window.localStorage.setItem(NAV_LOCAL_KEY, JSON.stringify({
        residence_id: selectedResidence.id,
        profile: travelMode,
        route: routeInfo,
        progress_m: currentProgressM,
        step_index: currentStepIndex,
        view: navigationView,
        started_at: new Date(now - Math.max(0, (routeInfo.duration_s - remainingDurationS) * 1000)).toISOString(),
        updated_at: new Date(now).toISOString(),
      }));
    } catch { /* local continuity is best effort */ }
  }, [currentProgressM, currentStepIndex, navigationActive, navigationView, remainingDurationS, routeInfo, selectedResidence, travelMode]);

  useEffect(() => { persistLocal(); }, [persistLocal]);

  const logNavigationEvent = useCallback(async (eventType: string, payload: Record<string, unknown> = {}) => {
    if (!user?.id || !sessionIdRef.current) return;
    try {
      await (supabase as any).from("resmap_navigation_events").insert({
        session_id: sessionIdRef.current,
        user_id: user.id,
        event_type: eventType,
        latitude: live.position?.latitude ?? null,
        longitude: live.position?.longitude ?? null,
        payload,
      });
    } catch { /* navigation must not depend on analytics */ }
  }, [live.position?.latitude, live.position?.longitude, user?.id]);

  const startSession = async (residence: any, info: RouteInfo, origin: Center) => {
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
        metadata: { source: "find_my_res_google_live_navigation_v2" },
      }).select("id").single();
      if (data?.id) sessionIdRef.current = data.id;
    } catch { /* navigation remains functional if logging is unavailable */ }
  };

  const buildRoute = useCallback(async (
    origin: Center,
    residence: any,
    opts?: { reroute?: boolean; enterNavigation?: boolean },
  ) => {
    if (!residence || !validCoord(residence)) return null;
    const toastId = opts?.reroute ? "resmap-reroute-v2" : "resmap-route-v2";
    if (!opts?.reroute) toast.loading("Preparing live route…", { id: toastId });

    const { data, error } = await supabase.functions.invoke("resmap-spatial", {
      body: {
        action: "route",
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: Number(residence.latitude), lng: Number(residence.longitude) },
        profile: travelMode,
      },
    });
    if (error || !data?.ok) {
      if (!opts?.reroute) toast.error(data?.error || error?.message || "Could not build route", { id: toastId });
      return null;
    }

    const info: RouteInfo = {
      distance_m: Number(data.distance_m || 0),
      duration_s: Number(data.duration_s || 0),
      provider: String(data.provider || "route"),
      profile: travelMode,
      geometry: data.geometry,
      steps: Array.isArray(data.steps) ? data.steps : [],
    };

    progressRef.current = 0;
    snapRef.current = null;
    destinationRef.current = residence;
    setSelectedResidence(residence);
    setRouteInfo(info);
    setCurrentProgressM(0);
    setRemainingDistanceM(info.distance_m);
    setRemainingDurationS(info.duration_s);
    setCurrentStepIndex(0);
    setArrived(false);

    if (opts?.enterNavigation !== false) {
      setNavigationActive(true);
      setNavigationView("route");
      setFollowUser(true);
      await startSession(residence, info, origin);
      mapRef.current?.panTo({ lat: origin.latitude, lng: origin.longitude });
      mapRef.current?.setZoom(18);
    }

    if (opts?.reroute) {
      void logNavigationEvent("rerouted", { distance_m: info.distance_m, provider: info.provider });
    } else {
      toast.success(`${Math.max(1, Math.round(info.duration_s / 60))} min · ${(info.distance_m / 1000).toFixed(1)} km`, { id: toastId });
    }
    return info;
  }, [logNavigationEvent, travelMode, user?.id]);

  const requestRoute = async () => {
    if (!selectedResidence) return;
    let origin = userLocation;
    if (live.status !== "granted" || !origin) {
      const ok = await requestLiveLocation();
      const snapshot = live.position;
      if (!ok && !snapshot) {
        toast.info("Allow live location so ResMap can route from where you are.");
        return;
      }
      origin = snapshot ? { latitude: snapshot.latitude, longitude: snapshot.longitude } : origin;
    }
    if (!origin) {
      toast.info("Waiting for a GPS fix. Keep Location enabled and try again.");
      return;
    }
    await buildRoute(origin, selectedResidence, { enterNavigation: true });
  };

  useEffect(() => {
    if (!navigationActive || !routeInfo || !userLocation || routeCoords.length < 2) return;
    const snap = snapToRoute(userLocation, routeCoords, routeMetrics.cumulative, progressRef.current);
    if (!snap) return;

    snapRef.current = snap;
    setRouteDeviationM(snap.distanceM);
    setRouteHeading(snap.heading);

    const progress = Math.max(progressRef.current, snap.progressM - 8);
    progressRef.current = progress;
    setCurrentProgressM(progress);

    const routeTotal = Math.max(routeMetrics.total, routeInfo.distance_m, 1);
    const remaining = Math.max(0, routeTotal - progress);
    const duration = Math.max(0, routeInfo.duration_s * (remaining / routeTotal));
    setRemainingDistanceM(remaining);
    setRemainingDurationS(duration);

    if (stepProgresses.length) {
      let nextIndex = currentStepIndex;
      while (
        nextIndex < stepProgresses.length - 1 &&
        progress > (stepProgresses[nextIndex] ?? 0) + 12
      ) nextIndex += 1;
      if (nextIndex !== currentStepIndex) {
        setCurrentStepIndex(nextIndex);
        void logNavigationEvent("step_changed", {
          step_index: nextIndex,
          instruction: routeInfo.steps[nextIndex]?.instruction || null,
        });
      }
    }

    const destination = destinationRef.current || selectedResidence;
    const destinationDistance = destination
      ? liveDistanceKm(userLocation, centerOf(destination)) * 1000
      : Number.POSITIVE_INFINITY;
    const arrivalThreshold = Math.max(18, Math.min(35, (live.position?.accuracy || 10) * 1.2));
    if (!arrived && (destinationDistance <= arrivalThreshold || remaining <= 18)) {
      setArrived(true);
      setRemainingDistanceM(0);
      setRemainingDurationS(0);
      setCurrentStepIndex(Math.max(0, (routeInfo.steps?.length || 1) - 1));
      void logNavigationEvent("arrival_detected", {
        distance_m: Math.round(destinationDistance),
        accuracy_m: live.position?.accuracy || null,
      });
    }

    const offRouteThreshold = travelMode === "walk" ? 45 : travelMode === "bike" ? 60 : 80;
    if (
      snap.distanceM > offRouteThreshold &&
      destination &&
      Date.now() - lastRerouteRef.current > 12000
    ) {
      lastRerouteRef.current = Date.now();
      void buildRoute(userLocation, destination, { reroute: true, enterNavigation: false });
    }
  }, [
    arrived,
    buildRoute,
    currentStepIndex,
    live.position?.accuracy,
    logNavigationEvent,
    navigationActive,
    routeCoords,
    routeInfo,
    routeMetrics.cumulative,
    routeMetrics.total,
    selectedResidence,
    stepProgresses,
    travelMode,
    userLocation?.latitude,
    userLocation?.longitude,
  ]);

  useEffect(() => {
    if (!navigationActive || !user?.id || !sessionIdRef.current || !live.position || !routeInfo) return;
    const now = Date.now();
    if (now - lastSessionSyncRef.current < 8000) return;
    lastSessionSyncRef.current = now;
    void (supabase as any).from("resmap_navigation_sessions").update({
      last_lat: live.position.latitude,
      last_lng: live.position.longitude,
      last_accuracy_m: Math.round(live.position.accuracy),
      last_heading: routeHeading == null ? null : Math.round(routeHeading),
      last_speed_mps: live.position.speed,
      last_seen_at: new Date(now).toISOString(),
      remaining_m: Math.round(remainingDistanceM),
      progress_m: Math.round(currentProgressM),
      eta_at: new Date(now + remainingDurationS * 1000).toISOString(),
      current_step_index: currentStepIndex,
      metadata: {
        source: "find_my_res_google_live_navigation_v2",
        route_deviation_m: Math.round(routeDeviationM),
        navigation_view: navigationView,
      },
    }).eq("id", sessionIdRef.current).eq("user_id", user.id);
  }, [
    currentProgressM,
    currentStepIndex,
    live.position,
    navigationActive,
    navigationView,
    remainingDistanceM,
    remainingDurationS,
    routeDeviationM,
    routeHeading,
    routeInfo,
    user?.id,
  ]);

  const updateStreetView = useCallback(async (forceHeading = false) => {
    const google = googleRef.current;
    const routeSnap = snapRef.current;
    if (!google || !streetNode.current || !userLocation || !navigationActive || navigationView !== "street") return;

    if (!streetServiceRef.current) {
      const { StreetViewService } = await google.maps.importLibrary("streetView");
      streetServiceRef.current = new StreetViewService();
    }

    const routePoint = routeSnap?.point || userLocation;
    const lookAhead = pointAlongRoute(routeCoords, routeMetrics.cumulative, currentProgressM + 12) || routePoint;
    const heading = routeSnap?.heading ?? bearingBetween(routePoint, lookAhead);
    const last = streetLastPanoPointRef.current;
    const moved = last ? liveDistanceKm(last, routePoint) * 1000 : 999;
    const due = Date.now() - streetLastPanoAtRef.current > 4500;
    if (!forceHeading && moved < 10 && !due && panoramaRef.current) return;

    streetLastPanoAtRef.current = Date.now();
    const service = streetServiceRef.current;
    const response = await service.getPanorama({
      location: { lat: routePoint.latitude, lng: routePoint.longitude },
      radius: 65,
      preference: google.maps.StreetViewPreference.NEAREST,
      source: google.maps.StreetViewSource.OUTDOOR,
    });

    const panoId = response?.data?.location?.pano;
    if (!panoId) throw new Error("No outdoor Street View coverage on this route segment");

    if (!panoramaRef.current) {
      const { StreetViewPanorama } = await google.maps.importLibrary("streetView");
      panoramaRef.current = new StreetViewPanorama(streetNode.current, {
        pano: panoId,
        pov: { heading, pitch: 0 },
        zoom: 1,
        addressControl: false,
        fullscreenControl: false,
        linksControl: true,
        motionTracking: false,
        motionTrackingControl: false,
        panControl: false,
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

    streetLastPanoPointRef.current = routePoint;
    setStreetReady(true);
    setStreetUnavailable(false);

    const destination = destinationRef.current || selectedResidence;
    if (destination) {
      if (!streetDestinationMarkerRef.current) {
        streetDestinationMarkerRef.current = new google.maps.Marker({
          map: panoramaRef.current,
          position: { lat: Number(destination.latitude), lng: Number(destination.longitude) },
          title: destination.name || "Destination",
          icon: {
            url: destinationSvg(arrived),
            scaledSize: new google.maps.Size(48, 58),
            anchor: new google.maps.Point(24, 56),
          },
        });
      } else {
        streetDestinationMarkerRef.current.setMap(panoramaRef.current);
        streetDestinationMarkerRef.current.setPosition({ lat: Number(destination.latitude), lng: Number(destination.longitude) });
        streetDestinationMarkerRef.current.setIcon({
          url: destinationSvg(arrived),
          scaledSize: new google.maps.Size(48, 58),
          anchor: new google.maps.Point(24, 56),
        });
      }
    }
  }, [
    arrived,
    currentProgressM,
    navigationActive,
    navigationView,
    routeCoords,
    routeMetrics.cumulative,
    selectedResidence,
    userLocation?.latitude,
    userLocation?.longitude,
  ]);

  useEffect(() => {
    if (!navigationActive || navigationView !== "street") return;
    updateStreetView(false).catch((error) => {
      console.warn("Route-aware Street View unavailable", error);
      setStreetUnavailable(true);
      setStreetReady(false);
      setNavigationView("route");
      toast.info("Street View coverage is unavailable here. Live route guidance is still active.");
    });
  }, [
    currentProgressM,
    currentStepIndex,
    navigationActive,
    navigationView,
    updateStreetView,
    userLocation?.latitude,
    userLocation?.longitude,
  ]);

  useEffect(() => {
    if (!residences.length || navigationActive || routeInfo) return;
    try {
      const raw = window.localStorage.getItem(NAV_LOCAL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      const updated = Date.parse(saved?.updated_at || saved?.started_at || "");
      if (!Number.isFinite(updated) || Date.now() - updated > MAX_ROUTE_AGE_MS) {
        window.localStorage.removeItem(NAV_LOCAL_KEY);
        return;
      }
      const residence = residences.find((row: any) => String(row.id) === String(saved?.residence_id));
      if (!residence || !saved?.route?.geometry) return;
      destinationRef.current = residence;
      progressRef.current = Number(saved.progress_m || 0);
      setSelectedResidence(residence);
      setTravelMode(saved.profile || "walk");
      setRouteInfo(saved.route as RouteInfo);
      setCurrentProgressM(Number(saved.progress_m || 0));
      setCurrentStepIndex(Number(saved.step_index || 0));
      setNavigationView(saved.view === "street" ? "street" : "route");
      setNavigationActive(true);
      setFollowUser(true);
      setRemainingDistanceM(Math.max(0, Number(saved.route.distance_m || 0) - Number(saved.progress_m || 0)));
      setRemainingDurationS(Number(saved.route.duration_s || 0));
    } catch { /* stale snapshot ignored */ }
  }, [navigationActive, residences, routeInfo]);

  const endNavigation = async (status: "completed" | "cancelled") => {
    if (user?.id && sessionIdRef.current) {
      try {
        await (supabase as any).from("resmap_navigation_sessions").update({
          status,
          ended_at: new Date().toISOString(),
          remaining_m: Math.round(remainingDistanceM),
          last_lat: live.position?.latitude ?? null,
          last_lng: live.position?.longitude ?? null,
          last_seen_at: new Date().toISOString(),
        }).eq("id", sessionIdRef.current).eq("user_id", user.id);
      } catch { /* no-op */ }
    }

    try { window.localStorage.removeItem(NAV_LOCAL_KEY); } catch { /* no-op */ }
    sessionIdRef.current = null;
    destinationRef.current = null;
    progressRef.current = 0;
    snapRef.current = null;
    setNavigationActive(false);
    setNavigationView("route");
    setRouteInfo(null);
    setCurrentProgressM(0);
    setCurrentStepIndex(0);
    setRemainingDistanceM(0);
    setRemainingDurationS(0);
    setArrived(false);
    setStreetReady(false);
    setStreetUnavailable(false);
    panoramaRef.current?.setVisible?.(false);
    streetDestinationMarkerRef.current?.setMap?.(null);
    streetDestinationMarkerRef.current = null;
    destinationMarkerRef.current?.setMap?.(null);
    routePolylineRef.current?.setMap?.(null);
    routePolylineRef.current = null;
    if (selectedResidence && mapRef.current) {
      mapRef.current.panTo({ lat: Number(selectedResidence.latitude), lng: Number(selectedResidence.longitude) });
      mapRef.current.setZoom(16);
    }
  };

  const locateMe = async () => {
    const ok = live.status === "granted" || await requestLiveLocation();
    const pos = live.position;
    if (!ok && !pos) {
      toast.error("Enable Location for reskonnect.org to use live navigation.");
      return;
    }
    const point = pos ? { lat: pos.latitude, lng: pos.longitude } : null;
    if (point && mapRef.current) {
      mapRef.current.panTo(point);
      mapRef.current.setZoom(navigationActive ? 18 : 16);
      setFollowUser(true);
    }
  };

  const chooseCampus = (key: string) => {
    setSelectedCampusKey(key);
    const campus = campuses.find((row) => row.campus_key === key);
    if (campus && mapRef.current) {
      mapRef.current.panTo({ lat: campus.latitude, lng: campus.longitude });
      mapRef.current.setZoom(14);
    }
  };

  const applyAiFilters = (result: any) => {
    if (!result) return;
    if (result.searchQuery) updateFilter("searchQuery", result.searchQuery);
    if (result.nsfasOnly != null) updateFilter("nsfasOnly", Boolean(result.nsfasOnly));
    if (Number(result.priceMax) > 0) updateFilter("priceMax", Number(result.priceMax));
    if (result.roomType) updateFilter("roomTypes", [String(result.roomType)]);
    if (result.wifiOnly != null) updateFilter("wifiOnly", Boolean(result.wifiOnly));
    if (result.parkingOnly != null) updateFilter("parkingOnly", Boolean(result.parkingOnly));
    if (result.availability) updateFilter("availability", result.availability);
    if (result.travelMode) setTravelMode(result.travelMode);
    if (Number(result.travelTimeMax) > 0) setTravelTimeMax(Number(result.travelTimeMax));
    if (result.campus) {
      const query = String(result.campus).toLowerCase();
      const campus = campuses.find((row) =>
        [row.name, row.short_name, ...(row.aliases || [])].filter(Boolean).some((value) =>
          String(value).toLowerCase().includes(query) || query.includes(String(value).toLowerCase()),
        ),
      );
      if (campus) chooseCampus(campus.campus_key);
    }
    setAiSummary(result.summary || "Map updated from your request.");
  };

  const askDimpho = async () => {
    const query = aiQuery.trim();
    if (query.length < 3) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("resmap-spatial", {
        body: { action: "ai_intent", query },
      });
      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Map search failed");
      applyAiFilters(data.filters);
    } catch {
      const fallback = parseSpatialIntent(query);
      applyAiFilters(fallback);
    } finally {
      setAiLoading(false);
    }
  };

  if (googleStatus === "failed") {
    return <ResMapExperiencePremium filters={filters} updateFilter={updateFilter} resetFilters={resetFilters} onClose={onClose} />;
  }

  const eta = new Date(Date.now() + remainingDurationS * 1000);
  const TravelIcon = travelMode === "walk" ? Footprints : travelMode === "bike" ? Bike : travelMode === "transport" ? Bus : Car;

  return (
    <div className="fixed inset-0 z-[120] h-[100dvh] w-screen overflow-hidden bg-slate-100 text-slate-950">
      <div ref={mapNode} className={`absolute inset-0 ${navigationView === "street" ? "invisible" : "visible"}`} />
      <div ref={streetNode} className={`absolute inset-0 bg-slate-200 ${navigationView === "street" ? "visible" : "invisible"}`} />

      {!navigationActive && (
        <>
          <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pb-2 pt-[calc(10px+env(safe-area-inset-top))] sm:px-5">
            <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-[20px] border border-white/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
              <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border bg-white" aria-label="Close ResMap"><X className="h-5 w-5" /></button>
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2"><p className="text-xl font-black">ResMap</p><Badge className="bg-cyan-500 text-white">LIVE</Badge></div>
                <p className="truncate text-[11px] text-muted-foreground">Live accommodation · Google map · ResKonnect data</p>
              </div>
            </div>
            <button type="button" onClick={locateMe} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-[18px] border border-white/80 bg-white/95 shadow-xl backdrop-blur" aria-label="Locate me"><LocateFixed className="h-5 w-5" /></button>
          </header>

          <div className="pointer-events-none absolute left-1/2 top-[calc(76px+env(safe-area-inset-top))] z-40 w-[calc(100%-20px)] max-w-3xl -translate-x-1/2">
            <div className="pointer-events-auto rounded-[20px] border border-white/80 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1"><Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" /><Input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void askDimpho(); }} placeholder='Ask Dimpho: "NSFAS single room near me"' className="h-11 border-0 bg-slate-50 pl-9 text-sm shadow-none" /></div>
                <Button onClick={() => void askDimpho()} disabled={aiLoading} className="h-11 shrink-0 bg-[#0b3d70] px-4"><Search className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Search</span></Button>
              </div>
              <p className="mt-1.5 truncate px-2 text-[10px] text-muted-foreground">{aiSummary}</p>
            </div>
          </div>

          <div className="absolute bottom-[calc(14px+env(safe-area-inset-bottom))] left-3 z-40">
            <Button onClick={() => setControlsOpen((value) => !value)} className="h-12 rounded-full bg-[#0b3d70] px-5 shadow-xl"><SlidersHorizontal className="mr-2 h-4 w-4" />Map controls</Button>
          </div>

          {controlsOpen && (
            <div className="absolute bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 z-50 max-h-[64dvh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-[24px] border border-white/80 bg-white/98 p-4 shadow-2xl backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between"><p className="font-black">Map controls</p><button onClick={() => setControlsOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100"><X className="h-4 w-4" /></button></div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Campus orbit</label>
              <select value={selectedCampusKey} onChange={(e) => chooseCampus(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm">
                <option value="">All mapped areas</option>
                {campuses.map((campus) => <option key={campus.id} value={campus.campus_key}>{campus.name}</option>)}
              </select>
              <div className="mt-3 flex flex-wrap gap-2">{[0, 0.5, 1, 2, 3, 5].map((km) => <button key={km} onClick={() => setOrbitRadiusKm(km)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${orbitRadiusKm === km ? "bg-[#0b3d70] text-white" : "bg-white"}`}>{km === 0 ? "Any distance" : `${km} km`}</button>)}</div>

              <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Travel mode</label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {([["walk", Footprints], ["bike", Bike], ["drive", Car], ["transport", Bus]] as const).map(([mode, Icon]) => <button key={mode} onClick={() => setTravelMode(mode)} className={`grid place-items-center rounded-xl border p-2 text-[10px] font-bold capitalize ${travelMode === mode ? "bg-[#0b3d70] text-white" : "bg-white"}`}><Icon className="mb-1 h-4 w-4" />{mode}</button>)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">{[0, 10, 15, 20, 30].map((mins) => <button key={mins} onClick={() => setTravelTimeMax(mins)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${travelTimeMax === mins ? "bg-cyan-600 text-white" : "bg-white"}`}>{mins === 0 ? "Any time" : `≤ ${mins} min`}</button>)}</div>

              <label className="mt-4 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Live filters</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => updateFilter("nsfasOnly", !filters.nsfasOnly)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filters.nsfasOnly ? "bg-emerald-600 text-white" : "bg-white"}`}>NSFAS</button>
                <button onClick={() => updateFilter("wifiOnly", !filters.wifiOnly)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filters.wifiOnly ? "bg-blue-600 text-white" : "bg-white"}`}>Wi-Fi</button>
                <button onClick={() => updateFilter("singlesOnly", !filters.singlesOnly)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filters.singlesOnly ? "bg-violet-600 text-white" : "bg-white"}`}>Single</button>
                <button onClick={() => updateFilter("availability", filters.availability === "available" ? "all" : "available")} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${filters.availability === "available" ? "bg-amber-600 text-white" : "bg-white"}`}>Available</button>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs"><span>{displayedMapped.length} mapped matches</span><button onClick={resetFilters} className="font-bold text-blue-700">Reset filters</button></div>
            </div>
          )}

          {selectedResidence && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center sm:bottom-4 sm:right-4 sm:left-auto sm:block">
              <ResMapResidenceCard
                residence={selectedResidence}
                routeInfo={routeInfo}
                travelMode={travelMode}
                onRoute={requestRoute}
                onClose={() => { setSelectedResidence(null); setRouteInfo(null); }}
              />
            </div>
          )}
        </>
      )}

      {navigationActive && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] px-3 pt-[calc(10px+env(safe-area-inset-top))] sm:px-5">
            <div className={`pointer-events-auto mx-auto max-w-3xl overflow-hidden rounded-[24px] shadow-2xl ${arrived ? "bg-emerald-700" : "bg-[#086d68]"} text-white`}>
              <div className="flex items-center gap-3 p-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15"><ManeuverIcon className="h-7 w-7" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white/75">{arrived ? "Destination reached" : nextManeuverDistanceM > 15 ? `In ${humanDistance(nextManeuverDistanceM)}` : "Now"}</p>
                  <p className="truncate text-xl font-black sm:text-2xl">{arrived ? `Arrive at ${selectedResidence?.name || "destination"}` : currentStep?.instruction || "Continue on the route"}</p>
                </div>
                <button type="button" onClick={() => void endNavigation(arrived ? "completed" : "cancelled")} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-slate-950" aria-label={arrived ? "Finish navigation" : "Exit navigation"}><X className="h-5 w-5" /></button>
              </div>
            </div>
          </div>

          <div className="absolute right-3 top-[calc(104px+env(safe-area-inset-top))] z-[70] flex flex-col gap-2">
            <button type="button" onClick={() => { setNavigationView("route"); setFollowUser(true); }} className={`grid h-12 w-12 place-items-center rounded-full border shadow-xl ${navigationView === "route" ? "bg-[#0b3d70] text-white" : "bg-white"}`} aria-label="Route map"><Navigation className="h-5 w-5" /></button>
            <button type="button" onClick={() => { setNavigationView("street"); setStreetReady(false); setStreetUnavailable(false); }} className={`grid h-12 w-12 place-items-center rounded-full border shadow-xl ${navigationView === "street" ? "bg-[#0b3d70] text-white" : "bg-white"}`} aria-label="Live Street View"><Eye className="h-5 w-5" /></button>
            <button type="button" onClick={() => { if (navigationView === "street") void updateStreetView(true); else void locateMe(); setFollowUser(true); }} className="grid h-12 w-12 place-items-center rounded-full border bg-white shadow-xl" aria-label="Re-centre"><LocateFixed className="h-5 w-5" /></button>
          </div>

          {navigationView === "street" && !streetReady && !streetUnavailable && (
            <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-white/20 backdrop-blur-[2px]"><div className="rounded-full bg-slate-950/80 px-4 py-2 text-sm font-bold text-white">Aligning Street View to your route…</div></div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[70] px-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:px-5">
            <div className="pointer-events-auto mx-auto max-w-3xl rounded-[26px] border border-white/80 bg-white/96 p-4 shadow-2xl backdrop-blur-xl">
              {arrived ? (
                <div className="flex items-center gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><MapPin className="h-7 w-7" /></div>
                  <div className="min-w-0 flex-1"><p className="text-xl font-black">You’ve arrived</p><p className="truncate text-sm text-muted-foreground">{selectedResidence?.name}</p></div>
                  <Button onClick={() => void endNavigation("completed")} className="bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />Done</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <TravelIcon className="h-5 w-5 text-blue-600" />
                    <div className="min-w-0 flex-1"><p className="text-2xl font-black">{Math.max(1, Math.ceil(remainingDurationS / 60))} min</p><p className="truncate text-xs text-muted-foreground">{humanDistance(remainingDistanceM)} · ETA {eta.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {selectedResidence?.name}</p></div>
                    <div className="shrink-0 text-right"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Off route</p><p className={`text-xs font-bold ${routeDeviationM > 60 ? "text-amber-600" : "text-emerald-700"}`}>{Math.round(routeDeviationM)} m</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setFollowUser(true); if (mapRef.current && userLocation) mapRef.current.panTo({ lat: userLocation.latitude, lng: userLocation.longitude }); }}><Compass className="mr-2 h-4 w-4" />Re-centre</Button>
                    <Button variant="destructive" className="flex-1" onClick={() => void endNavigation("cancelled")}>Exit route</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {googleStatus === "loading" && (
        <div className="absolute inset-0 z-[90] grid place-items-center bg-slate-100"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" /><p className="mt-3 text-sm font-bold">Starting premium ResMap…</p></div></div>
      )}

      {loading && !navigationActive && (
        <div className="pointer-events-none absolute bottom-4 right-4 z-30 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold shadow">Refreshing residences…</div>
      )}
    </div>
  );
}
