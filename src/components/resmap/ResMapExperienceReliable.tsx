import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BedSingle, Bike, Bus, Car, CheckCircle2, CircleDollarSign, Compass, Footprints, Layers3, LocateFixed, MapPinned, Rotate3D, Search, SlidersHorizontal, Sparkles, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeResidences } from "@/hooks/useRealtimeResidences";
import { isMockResidence, type ResidenceFilters } from "@/hooks/useResidenceFilters";
import { loadMapLibre } from "@/lib/resmap/maplibre";
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
  primary_provider: "reskonnect" | "google3d";
  google_maps_enabled: boolean;
  google_maps_browser_key?: string | null;
  google_maps_map_id?: string | null;
  google_maps_mode: "ROADMAP" | "SATELLITE" | "HYBRID";
  raster_primary_url: string;
  raster_fallback_url: string;
}

interface RouteInfo {
  distance_m: number;
  duration_s: number;
  provider: string;
  profile: TravelMode;
  geometry?: any;
}

type MapEngine = "reskonnect" | "google3d";
type MapHealth = "starting" | "healthy" | "degraded";

const SOUTH_AFRICA_CENTER: [number, number] = [25.45, -28.55];
const DEFAULT_MAP_CONFIG: MapConfig = {
  primary_provider: "reskonnect",
  google_maps_enabled: false,
  google_maps_browser_key: null,
  google_maps_map_id: null,
  google_maps_mode: "HYBRID",
  raster_primary_url: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
  raster_fallback_url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
};

const validCoord = (row: any) =>
  Number.isFinite(Number(row?.latitude)) &&
  Number.isFinite(Number(row?.longitude)) &&
  Number(row.latitude) >= -35.5 &&
  Number(row.latitude) <= -21 &&
  Number(row.longitude) >= 15 &&
  Number(row.longitude) <= 34;

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const featureCollection = (features: any[]) => ({ type: "FeatureCollection", features });
const pointFeature = (lng: number, lat: number, properties: any) => ({
  type: "Feature",
  properties,
  geometry: { type: "Point", coordinates: [lng, lat] },
});

function campusMatchesHint(campus: Campus, hint: string) {
  const hay = [campus.name, campus.short_name, ...(campus.aliases || [])].map(normalize).join(" | ");
  const needle = normalize(hint);
  if (!needle) return false;
  const short = normalize(campus.short_name);
  return hay.includes(needle) || (short.length > 1 && needle.includes(short)) || needle.split(" ").filter((x) => x.length > 2).every((x) => hay.includes(x));
}

function availabilityFor(row: any) {
  const spots = Number(row?.available_spots || 0);
  return spots > 5 ? "available" : spots > 0 ? "limited" : "unknown";
}

function residenceBeacon(row: any) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const meters = 22;
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const spots = Math.max(0, Number(row.available_spots || 0));
  const height = Math.min(58, 18 + Math.sqrt(spots + 1) * 3.5);
  return {
    type: "Feature",
    properties: {
      id: String(row.id),
      availability: availabilityFor(row),
      height,
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ]],
    },
  };
}

function safeRasterStyle(config: MapConfig) {
  return {
    version: 8,
    sources: {
      "rk-raster-fallback": {
        type: "raster",
        tiles: [config.raster_fallback_url || DEFAULT_MAP_CONFIG.raster_fallback_url],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
      "rk-raster-primary": {
        type: "raster",
        tiles: [config.raster_primary_url || DEFAULT_MAP_CONFIG.raster_primary_url],
        tileSize: 256,
        attribution: "© CARTO · © OpenStreetMap contributors",
      },
    },
    layers: [
      { id: "rk-background", type: "background", paint: { "background-color": "#e8eef4" } },
      { id: "rk-raster-fallback", type: "raster", source: "rk-raster-fallback", paint: { "raster-opacity": 1 } },
      { id: "rk-raster-primary", type: "raster", source: "rk-raster-primary", paint: { "raster-opacity": 1 } },
    ],
  };
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

export default function ResMapExperienceReliable({ filters, updateFilter, resetFilters, onClose }: Props) {
  const { residences, loading } = useRealtimeResidences();
  const mapNode = useRef<HTMLDivElement | null>(null);
  const googleNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const googleMapRef = useRef<any>(null);
  const googleMarkersRef = useRef<any[]>([]);
  const residencesRef = useRef<Map<string, any>>(new Map());
  const initialFitDone = useRef(false);
  const selectedRef = useRef<any>(null);
  const engineRef = useRef<MapEngine>("reskonnect");
  const is3dRef = useRef(true);

  const [config, setConfig] = useState<MapConfig>(DEFAULT_MAP_CONFIG);
  const [engine, setEngine] = useState<MapEngine>("reskonnect");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapHealth, setMapHealth] = useState<MapHealth>("starting");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusKey, setSelectedCampusKey] = useState("");
  const [orbitRadiusKm, setOrbitRadiusKm] = useState(3);
  const [travelMode, setTravelMode] = useState<TravelMode>("walk");
  const [travelTimeMax, setTravelTimeMax] = useState(0);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [is3d, setIs3d] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("Ask Dimpho to reshape the live map around what you need.");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const [campusRes, configRes] = await Promise.all([
        (supabase as any).from("resmap_campuses").select("id,campus_key,name,short_name,aliases,latitude,longitude").eq("is_active", true).order("name"),
        (supabase as any).from("resmap_map_config").select("*").eq("id", 1).maybeSingle(),
      ]);
      if (!active) return;
      setCampuses((campusRes.data || []).filter((c: Campus) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))));
      if (configRes.data) {
        const next = { ...DEFAULT_MAP_CONFIG, ...configRes.data } as MapConfig;
        setConfig(next);
        if (next.primary_provider === "google3d" && next.google_maps_enabled && next.google_maps_browser_key) setEngine("google3d");
      }
    })();
    return () => { active = false; };
  }, []);

  const selectedCampus = useMemo(
    () => campuses.find((campus) => campus.campus_key === selectedCampusKey) || null,
    [campuses, selectedCampusKey],
  );

  useEffect(() => {
    if (!campuses.length || filters.campus === "all") return;
    const match = campuses.find((campus) => campusMatchesHint(campus, filters.campus));
    if (match && match.campus_key !== selectedCampusKey) setSelectedCampusKey(match.campus_key);
  }, [campuses, filters.campus, selectedCampusKey]);

  const baseMatching = useMemo(
    () => residences.filter((row: any) => !isMockResidence(row) && row.map_hidden !== true && row.is_visible !== false && residenceMatchesMapFilters(row, filters)),
    [residences, filters],
  );
  const mappedMatching = useMemo(() => baseMatching.filter(validCoord), [baseMatching]);

  const displayedMapped = useMemo(() => {
    if (!selectedCampus || !Number.isFinite(Number(selectedCampus.latitude)) || !Number.isFinite(Number(selectedCampus.longitude))) return mappedMatching;
    const origin = { latitude: Number(selectedCampus.latitude), longitude: Number(selectedCampus.longitude) };
    return mappedMatching.filter((row: any) => {
      const km = haversineKm(origin, { latitude: Number(row.latitude), longitude: Number(row.longitude) });
      if (orbitRadiusKm > 0 && km > orbitRadiusKm) return false;
      if (travelTimeMax > 0 && estimateTravelMinutes(km, travelMode) > travelTimeMax) return false;
      return true;
    });
  }, [mappedMatching, selectedCampus, orbitRadiusKm, travelMode, travelTimeMax]);

  const allMapped = useMemo(
    () => residences.filter((row: any) => !isMockResidence(row) && row.map_hidden !== true && row.is_visible !== false && validCoord(row)),
    [residences],
  );
  const realResidenceCount = useMemo(() => residences.filter((row: any) => !isMockResidence(row)).length, [residences]);
  const mapReadiness = realResidenceCount ? Math.round((allMapped.length / realResidenceCount) * 100) : 0;
  const unmappedMatching = Math.max(0, baseMatching.length - mappedMatching.length);
  const google3dReady = Boolean(config.google_maps_enabled && config.google_maps_browser_key);

  useEffect(() => {
    residencesRef.current = new Map(residences.map((row: any) => [String(row.id), row]));
  }, [residences]);
  useEffect(() => { selectedRef.current = selectedResidence; }, [selectedResidence]);
  useEffect(() => { engineRef.current = engine; }, [engine]);
  useEffect(() => { is3dRef.current = is3d; }, [is3d]);

  const selectResidence = useCallback((id: string) => {
    const residence = residencesRef.current.get(String(id));
    if (!residence || !validCoord(residence)) return;
    setSelectedResidence(residence);
    setRouteInfo(null);
    if (engineRef.current === "reskonnect" && mapRef.current) {
      mapRef.current.flyTo({
        center: [Number(residence.longitude), Number(residence.latitude)],
        zoom: Math.max(mapRef.current.getZoom(), 15.5),
        pitch: is3dRef.current ? 62 : 0,
        bearing: is3dRef.current ? -18 : 0,
        duration: 850,
      });
    } else if (engineRef.current === "google3d" && googleMapRef.current) {
      googleMapRef.current.center = { lat: Number(residence.latitude), lng: Number(residence.longitude), altitude: 0 };
      googleMapRef.current.range = 1100;
      googleMapRef.current.tilt = 67.5;
    }
  }, []);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapNode.current) return;
    let disposed = false;
    let map: any;
    setMapReady(false);
    setMapError(null);
    setMapHealth("starting");

    loadMapLibre().then((maplibregl) => {
      if (disposed || !mapNode.current) return;
      map = new maplibregl.Map({
        container: mapNode.current,
        style: safeRasterStyle(config) as any,
        center: SOUTH_AFRICA_CENTER,
        zoom: 5.2,
        pitch: is3dRef.current ? 52 : 0,
        bearing: is3dRef.current ? -12 : 0,
        attributionControl: true,
        maxPitch: 75,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      let tileErrors = 0;

      map.on("load", () => {
        if (disposed) return;
        try {
          map.addSource("resmap-residences", { type: "geojson", data: featureCollection([]) });
          map.addLayer({
            id: "resmap-residence-glow",
            type: "circle",
            source: "resmap-residences",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 12, 9, 16, 15],
              "circle-color": "#0ea5e9",
              "circle-opacity": 0.18,
              "circle-blur": 0.45,
            },
          });
          map.addLayer({
            id: "resmap-residence-points",
            type: "circle",
            source: "resmap-residences",
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2.5, 12, 5.5, 16, 8.5],
              "circle-color": ["match", ["get", "availability"], "available", "#10b981", "limited", "#f59e0b", "#2563eb"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-opacity": 0.96,
            },
          });

          map.addSource("resmap-beacons", { type: "geojson", data: featureCollection([]) });
          map.addLayer({
            id: "resmap-3d-beacons",
            type: "fill-extrusion",
            source: "resmap-beacons",
            minzoom: 12,
            layout: { visibility: is3dRef.current ? "visible" : "none" },
            paint: {
              "fill-extrusion-color": ["match", ["get", "availability"], "available", "#10b981", "limited", "#f59e0b", "#2563eb"],
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": 0,
              "fill-extrusion-opacity": 0.78,
            },
          });

          map.addSource("resmap-campuses", { type: "geojson", data: featureCollection([]) });
          map.addLayer({
            id: "resmap-campus-points",
            type: "circle",
            source: "resmap-campuses",
            paint: {
              "circle-radius": ["case", ["get", "selected"], 11, 7],
              "circle-color": ["case", ["get", "selected"], "#7c3aed", "#111827"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 3,
            },
          });

          map.addSource("resmap-orbit", { type: "geojson", data: featureCollection([]) });
          map.addLayer({ id: "resmap-orbit-fill", type: "fill", source: "resmap-orbit", paint: { "fill-color": "#7c3aed", "fill-opacity": 0.045 } });
          map.addLayer({ id: "resmap-orbit-line", type: "line", source: "resmap-orbit", paint: { "line-color": "#7c3aed", "line-width": 1.8, "line-opacity": 0.65, "line-dasharray": [2, 2] } });

          map.addSource("resmap-route", { type: "geojson", data: featureCollection([]) });
          map.addLayer({ id: "resmap-route-glow", type: "line", source: "resmap-route", paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.8 } });
          map.addLayer({ id: "resmap-route-line", type: "line", source: "resmap-route", paint: { "line-color": "#0f6fff", "line-width": 5, "line-opacity": 0.96 } });

          map.addSource("resmap-selected", { type: "geojson", data: featureCollection([]) });
          map.addLayer({ id: "resmap-selected-ring", type: "circle", source: "resmap-selected", paint: { "circle-radius": 15, "circle-color": "rgba(255,255,255,0)", "circle-stroke-color": "#0f6fff", "circle-stroke-width": 4 } });

          map.addSource("resmap-user", { type: "geojson", data: featureCollection([]) });
          map.addLayer({ id: "resmap-user-dot", type: "circle", source: "resmap-user", paint: { "circle-radius": 7, "circle-color": "#111827", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });

          const handleResidenceClick = (event: any) => {
            const id = String(event.features?.[0]?.properties?.id || "");
            if (id) selectResidence(id);
          };
          map.on("click", "resmap-residence-points", handleResidenceClick);
          map.on("click", "resmap-3d-beacons", handleResidenceClick);
          for (const layer of ["resmap-residence-points", "resmap-3d-beacons"]) {
            map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
          }
          setMapReady(true);
          requestAnimationFrame(() => {
            try { map.resize(); } catch { /* removed */ }
          });
        } catch (error) {
          setMapError(error instanceof Error ? error.message : String(error));
        }
      });

      map.on("idle", () => {
        if (!disposed) setMapHealth("healthy");
      });
      map.on("error", (event: any) => {
        const message = String(event?.error?.message || "");
        if (/tile|raster|source|network|fetch|image/i.test(message)) tileErrors += 1;
        if (tileErrors >= 6 && !disposed) setMapHealth("degraded");
        if (/webgl|context lost|failed to initialize/i.test(message) && !disposed) setMapError(message);
      });
    }).catch((error) => {
      if (!disposed) setMapError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      disposed = true;
      if (map) {
        try { map.remove(); } catch { /* no-op */ }
      }
      mapRef.current = null;
      initialFitDone.current = false;
    };
  }, [config, engine, selectResidence]);

  useEffect(() => {
    if (engine !== "google3d" || !googleNode.current) return;
    if (!google3dReady || !config.google_maps_browser_key) {
      setEngine("reskonnect");
      return;
    }
    let disposed = false;
    setMapReady(false);
    setMapError(null);
    setMapHealth("starting");

    loadGoogleMaps(config.google_maps_browser_key).then(async (google) => {
      const { Map3DElement } = await google.maps.importLibrary("maps3d");
      if (disposed || !googleNode.current) return;
      const center = { lat: -25.7479, lng: 28.2293, altitude: 0 };
      const options: any = {
        center,
        tilt: 67.5,
        heading: 0,
        range: 260000,
        mode: config.google_maps_mode || "HYBRID",
      };
      if (config.google_maps_map_id) options.mapId = config.google_maps_map_id;
      const map3d = new Map3DElement(options);
      map3d.style.width = "100%";
      map3d.style.height = "100%";
      googleNode.current.replaceChildren(map3d);
      googleMapRef.current = map3d;
      setMapReady(true);
      setMapHealth("healthy");
    }).catch((error) => {
      if (disposed) return;
      toast.error("Google 3D could not initialize. ResMap switched to its resilient map engine.");
      setMapError(null);
      setEngine("reskonnect");
      setMapHealth("degraded");
      console.error("ResMap Google 3D initialization failed", error);
    });

    return () => {
      disposed = true;
      googleMarkersRef.current.forEach((marker) => {
        try { marker.remove(); } catch { /* no-op */ }
      });
      googleMarkersRef.current = [];
      if (googleNode.current) googleNode.current.replaceChildren();
      googleMapRef.current = null;
    };
  }, [config, engine, google3dReady]);

  useEffect(() => {
    if (engine !== "google3d" || !mapReady || !googleMapRef.current || !google3dReady) return;
    let active = true;
    (async () => {
      try {
        const google = (window as any).google;
        const { Marker3DInteractiveElement } = await google.maps.importLibrary("maps3d");
        if (!active || !googleMapRef.current) return;
        googleMarkersRef.current.forEach((marker) => {
          try { marker.remove(); } catch { /* no-op */ }
        });
        const markers = displayedMapped.map((row: any) => {
          const marker = new Marker3DInteractiveElement({
            position: { lat: Number(row.latitude), lng: Number(row.longitude), altitude: 0 },
            label: String(row.name || "Residence").slice(0, 42),
            title: String(row.name || "Residence"),
            extruded: true,
            sizePreserved: true,
          });
          marker.addEventListener("gmp-click", () => selectResidence(String(row.id)));
          googleMapRef.current.append(marker);
          return marker;
        });
        googleMarkersRef.current = markers;
      } catch (error) {
        console.warn("ResMap Google 3D markers could not update", error);
      }
    })();
    return () => { active = false; };
  }, [displayedMapped, engine, google3dReady, mapReady, selectResidence]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current) return;
    mapRef.current.getSource("resmap-residences")?.setData(featureCollection(displayedMapped.map((row: any) =>
      pointFeature(Number(row.longitude), Number(row.latitude), {
        id: String(row.id),
        availability: availabilityFor(row),
      }),
    )));
    mapRef.current.getSource("resmap-beacons")?.setData(featureCollection(displayedMapped.map(residenceBeacon)));
  }, [displayedMapped, engine, mapReady]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current) return;
    mapRef.current.getSource("resmap-campuses")?.setData(featureCollection(campuses.filter((campus) => Number.isFinite(Number(campus.latitude)) && Number.isFinite(Number(campus.longitude))).map((campus) =>
      pointFeature(Number(campus.longitude), Number(campus.latitude), { id: campus.campus_key, selected: campus.campus_key === selectedCampusKey }),
    )));
  }, [campuses, engine, mapReady, selectedCampusKey]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("resmap-orbit");
    if (!source) return;
    if (!selectedCampus) {
      source.setData(featureCollection([]));
      return;
    }
    const lat = Number(selectedCampus.latitude);
    const lng = Number(selectedCampus.longitude);
    const radii = [0.5, 1, 2, 3, 5].filter((radius) => radius <= Math.max(3, orbitRadiusKm || 0));
    source.setData(featureCollection(radii.map((radius) => circlePolygon(lat, lng, radius))));
    const zoom = orbitRadiusKm === 0 ? 11 : orbitRadiusKm <= 0.5 ? 15.2 : orbitRadiusKm <= 1 ? 14.4 : orbitRadiusKm <= 2 ? 13.4 : orbitRadiusKm <= 3 ? 12.8 : 12;
    mapRef.current.flyTo({ center: [lng, lat], zoom, pitch: is3d ? 58 : 0, bearing: is3d ? -16 : 0, duration: 800 });
  }, [engine, is3d, mapReady, orbitRadiusKm, selectedCampus]);

  useEffect(() => {
    if (engine === "google3d" && selectedCampus && googleMapRef.current) {
      googleMapRef.current.center = { lat: Number(selectedCampus.latitude), lng: Number(selectedCampus.longitude), altitude: 0 };
      googleMapRef.current.range = orbitRadiusKm === 0 ? 12000 : Math.max(1800, orbitRadiusKm * 2300);
      googleMapRef.current.tilt = 67.5;
    }
  }, [engine, orbitRadiusKm, selectedCampus]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current) return;
    try {
      if (mapRef.current.getLayer("resmap-3d-beacons")) {
        mapRef.current.setLayoutProperty("resmap-3d-beacons", "visibility", is3d ? "visible" : "none");
      }
      mapRef.current.easeTo({ pitch: is3d ? 58 : 0, bearing: is3d ? -16 : 0, duration: 450 });
    } catch { /* optional visual state */ }
  }, [engine, is3d, mapReady]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("resmap-selected");
    if (!source) return;
    source.setData(selectedResidence && validCoord(selectedResidence)
      ? featureCollection([pointFeature(Number(selectedResidence.longitude), Number(selectedResidence.latitude), { id: selectedResidence.id })])
      : featureCollection([]));
  }, [engine, mapReady, selectedResidence]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current || !userLocation) return;
    mapRef.current.getSource("resmap-user")?.setData(featureCollection([pointFeature(userLocation.longitude, userLocation.latitude, {})]));
  }, [engine, mapReady, userLocation]);

  useEffect(() => {
    if (engine !== "reskonnect" || !mapReady || !mapRef.current || initialFitDone.current || selectedCampus || displayedMapped.length === 0) return;
    const maplibregl = (window as any).maplibregl;
    if (!maplibregl?.LngLatBounds) return;
    const first = displayedMapped[0];
    const bounds = new maplibregl.LngLatBounds([Number(first.longitude), Number(first.latitude)], [Number(first.longitude), Number(first.latitude)]);
    displayedMapped.forEach((row: any) => bounds.extend([Number(row.longitude), Number(row.latitude)]));
    mapRef.current.fitBounds(bounds, { padding: 70, maxZoom: 11.5, duration: 700 });
    initialFitDone.current = true;
  }, [displayedMapped, engine, mapReady, selectedCampus]);

  const chooseCampus = (campusKey: string) => {
    setSelectedCampusKey(campusKey);
    const campus = campuses.find((row) => row.campus_key === campusKey);
    if (campus) updateFilter("campus", campusFilterValue(campus));
    else updateFilter("campus", "all");
    setSelectedResidence(null);
    setRouteInfo(null);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(next);
      if (engine === "reskonnect") {
        mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 15, pitch: is3d ? 52 : 0, duration: 800 });
      } else if (googleMapRef.current) {
        googleMapRef.current.center = { lat: next.latitude, lng: next.longitude, altitude: 0 };
        googleMapRef.current.range = 1800;
      }
      toast.success("ResMap centered on your current location");
    }, () => toast.error("Location permission was not granted"), { enableHighAccuracy: true, timeout: 9000, maximumAge: 15_000 });
  };

  const requestRoute = async () => {
    if (!selectedResidence || !validCoord(selectedResidence)) return;
    const origin = selectedCampus
      ? { lat: Number(selectedCampus.latitude), lng: Number(selectedCampus.longitude) }
      : userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : null;
    if (!origin) {
      toast.info("Choose a campus or tap Locate me first so ResMap knows where your journey starts.");
      return;
    }
    const destination = { lat: Number(selectedResidence.latitude), lng: Number(selectedResidence.longitude) };
    toast.loading("Building your live route…", { id: "resmap-route" });
    const { data, error } = await supabase.functions.invoke("resmap-spatial", { body: { action: "route", origin, destination, profile: travelMode } });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || "Could not build route", { id: "resmap-route" });
      return;
    }
    const info: RouteInfo = {
      distance_m: Number(data.distance_m),
      duration_s: Number(data.duration_s),
      provider: String(data.provider),
      profile: travelMode,
      geometry: data.geometry,
    };
    setRouteInfo(info);
    if (engine === "reskonnect") {
      const source = mapRef.current?.getSource("resmap-route");
      if (source && data.geometry) source.setData(featureCollection([{ type: "Feature", properties: {}, geometry: data.geometry }]));
      const coords = data.geometry?.coordinates || [];
      const maplibregl = (window as any).maplibregl;
      if (coords.length > 1 && mapRef.current && maplibregl?.LngLatBounds) {
        const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
        coords.forEach((coord: number[]) => bounds.extend(coord));
        mapRef.current.fitBounds(bounds, { padding: { top: 145, right: 60, bottom: 290, left: 60 }, maxZoom: 15.5, duration: 800 });
      }
    }
    toast.success(`${Math.max(1, Math.round(info.duration_s / 60))} min · ${(info.distance_m / 1000).toFixed(1)} km`, { id: "resmap-route" });
  };

  const applyCampusHint = (hint?: string | null) => {
    if (!hint) return false;
    const campus = campuses.find((row) => campusMatchesHint(row, hint));
    if (campus) {
      chooseCampus(campus.campus_key);
      return true;
    }
    updateFilter("campus", hint as any);
    return false;
  };

  const applyAiResult = (result: any) => {
    if (!result) return;
    if (result.campus) applyCampusHint(result.campus);
    if (typeof result.nsfasOnly === "boolean") updateFilter("nsfasOnly", result.nsfasOnly);
    if (Number(result.priceMax) > 0) updateFilter("priceMax", Number(result.priceMax));
    if (result.roomType) {
      updateFilter("roomTypes", [String(result.roomType)]);
      updateFilter("singlesOnly", /single/i.test(String(result.roomType)));
    }
    if (typeof result.wifiOnly === "boolean") updateFilter("wifiOnly", result.wifiOnly);
    if (typeof result.parkingOnly === "boolean") updateFilter("parkingOnly", result.parkingOnly);
    if (["all", "available", "few_spots"].includes(result.availability)) updateFilter("availability", result.availability);
    if (result.searchQuery) updateFilter("searchQuery", String(result.searchQuery));
    if (["walk", "bike", "drive", "transport"].includes(result.travelMode)) setTravelMode(result.travelMode);
    if (Number(result.travelTimeMax) > 0) setTravelTimeMax(Number(result.travelTimeMax));
    if (result.summary) setAiSummary(result.summary);
  };

  const runAiSearch = async () => {
    const query = aiQuery.trim();
    if (!query) return;
    setAiLoading(true);
    const parsed = parseSpatialIntent(query);
    try {
      for (const [key, value] of Object.entries(parsed.filterPatch)) {
        if (value !== undefined) updateFilter(key as keyof ResidenceFilters, value as any);
      }
      if (parsed.campusHint) applyCampusHint(parsed.campusHint);
      if (parsed.travelMode) setTravelMode(parsed.travelMode);
      if (parsed.travelTimeMax) setTravelTimeMax(parsed.travelTimeMax);
      if (parsed.understood.length >= 2 || (parsed.understood.length >= 1 && parsed.campusHint)) {
        setAiSummary(`Mapped: ${parsed.understood.join(" · ")}`);
        toast.success("ResMap updated without using an AI request");
      } else {
        const { data, error } = await supabase.functions.invoke("resmap-spatial", { body: { action: "ai_intent", query } });
        if (error || !data?.ok) throw new Error(data?.error || error?.message || "AI map search failed");
        applyAiResult(data.filters);
        setAiSummary(data.filters?.summary || "Dimpho updated the map.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Could not understand that map search");
    } finally {
      setAiLoading(false);
    }
  };

  const switchEngine = () => {
    if (!google3dReady) {
      toast.info("Google 3D is wired into ResMap but needs the restricted Google Maps browser key enabled in AdminOS.");
      return;
    }
    setSelectedResidence(null);
    setRouteInfo(null);
    setEngine((current) => current === "google3d" ? "reskonnect" : "google3d");
  };

  const quickFilters = [
    { label: "NSFAS", active: filters.nsfasOnly, icon: CircleDollarSign, action: () => updateFilter("nsfasOnly", !filters.nsfasOnly) },
    { label: "Wi-Fi", active: filters.wifiOnly, icon: Wifi, action: () => updateFilter("wifiOnly", !filters.wifiOnly) },
    { label: "Single", active: filters.singlesOnly, icon: BedSingle, action: () => { const next = !filters.singlesOnly; updateFilter("singlesOnly", next); updateFilter("roomTypes", next ? ["single"] : []); } },
    { label: "Available", active: filters.availability === "available", icon: CheckCircle2, action: () => updateFilter("availability", filters.availability === "available" ? "all" : "available") },
  ];

  const modeButtons: Array<{ mode: TravelMode; label: string; icon: any }> = [
    { mode: "walk", label: "Walk", icon: Footprints },
    { mode: "bike", label: "Bike", icon: Bike },
    { mode: "drive", label: "Drive", icon: Car },
    { mode: "transport", label: "Transport", icon: Bus },
  ];

  const Controls = () => (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Campus Orbit</p>
          <Badge variant="outline">{displayedMapped.length} mapped</Badge>
        </div>
        <select
          value={selectedCampusKey}
          onChange={(event) => chooseCampus(event.target.value)}
          className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-900 outline-none dark:bg-slate-900 dark:text-white"
        >
          <option value="">All mapped areas</option>
          {campuses.map((campus) => <option key={campus.id} value={campus.campus_key}>{campus.name}</option>)}
        </select>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {[0, 0.5, 1, 2, 3, 5].map((radius) => (
            <button
              key={radius}
              onClick={() => setOrbitRadiusKm(radius)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${orbitRadiusKm === radius ? "bg-violet-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              {radius === 0 ? "Any" : `${radius} km`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Travel-time search</p>
        <div className="grid grid-cols-4 gap-1.5">
          {modeButtons.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => setTravelMode(mode)}
              className={`rounded-xl px-1 py-2 text-[10px] font-bold ${travelMode === mode ? "bg-[#07192e] text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              <Icon className="mx-auto mb-1 h-4 w-4" />{label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {[0, 10, 15, 20, 30, 45].map((minutes) => (
            <button
              key={minutes}
              onClick={() => setTravelTimeMax(minutes)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${travelTimeMax === minutes ? "bg-cyan-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              {minutes === 0 ? "Any time" : `≤ ${minutes} min`}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Instant time filters use spatial estimates. Route here uses the road network and Supabase route cache.</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Live Find My Res filters</p>
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map(({ label, active, icon: Icon, action }) => (
            <button
              key={label}
              onClick={action}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-blue-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
            >
              <Icon className="mr-1 inline h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">Max rent: R{filters.priceMax.toLocaleString("en-ZA")}</label>
        <input type="range" min={1500} max={10000} step={250} value={filters.priceMax} onChange={(event) => updateFilter("priceMax", Number(event.target.value))} className="mt-1 w-full accent-blue-600" />
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => {
          resetFilters();
          setSelectedCampusKey("");
          setTravelTimeMax(0);
          setOrbitRadiusKm(3);
          setSelectedResidence(null);
          setRouteInfo(null);
          initialFitDone.current = false;
        }}>
          Reset map search
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-[#e8eef4] text-slate-950 dark:text-white">
      <div ref={mapNode} className={`absolute inset-0 top-[64px] ${engine === "reskonnect" ? "block" : "hidden"}`} />
      <div ref={googleNode} className={`absolute inset-0 top-[64px] bg-[#e8eef4] ${engine === "google3d" ? "block" : "hidden"}`} />

      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/60 bg-white/94 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/94 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white dark:bg-slate-900" aria-label="Close ResMap"><X className="h-5 w-5" /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-black sm:text-xl">ResMap</h2>
              <Badge className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">LIVE</Badge>
              <Badge variant="outline" className="hidden sm:inline-flex">{engine === "google3d" ? "Google 3D" : "ResKonnect Spatial"}</Badge>
            </div>
            <p className="truncate text-[11px] text-slate-500">Real accommodation coordinates · {mapReadiness}% geo-ready · resilient basemap failover</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {google3dReady && <Button variant="outline" size="sm" onClick={switchEngine} className="hidden sm:inline-flex">{engine === "google3d" ? "ResKonnect Map" : "Google 3D"}</Button>}
          {engine === "reskonnect" && <Button variant="outline" size="sm" onClick={() => setIs3d((value) => !value)}><Rotate3D className="mr-1.5 h-4 w-4" />{is3d ? "3D" : "2D"}</Button>}
          <Button variant="outline" size="icon" onClick={locateMe} aria-label="Use my location"><LocateFixed className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className="pointer-events-none absolute left-1/2 top-[76px] z-30 w-[calc(100%-24px)] max-w-2xl -translate-x-1/2">
        <div className="pointer-events-auto rounded-[20px] border border-white/70 bg-white/94 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/94">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
              <Input
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void runAiSearch(); }}
                placeholder='Ask Dimpho: “NSFAS single room within 15 min walk of Soshanguve North”'
                className="h-11 border-0 bg-slate-50 pl-9 text-sm shadow-none dark:bg-slate-900"
              />
            </div>
            <Button className="h-11 shrink-0" onClick={() => void runAiSearch()} disabled={aiLoading}>
              {aiLoading ? "Thinking…" : <><Search className="mr-1.5 h-4 w-4" />Search</>}
            </Button>
          </div>
          <p className="mt-1.5 truncate px-2 text-[10px] text-slate-500">{aiSummary}</p>
        </div>
      </div>

      <aside className="pointer-events-auto absolute left-4 top-[158px] z-20 hidden w-[300px] rounded-[24px] border border-white/70 bg-white/94 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/94 md:block">
        <Controls />
      </aside>

      <div className="pointer-events-none absolute right-3 top-[158px] z-20 hidden max-w-[250px] gap-2 lg:flex lg:flex-col">
        <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/94 p-3 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/94">
          <div className="flex items-center gap-2 font-bold"><Layers3 className="h-4 w-4 text-blue-600" />Live spatial inventory</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{displayedMapped.length}</p><p className="text-[9px] text-slate-500">ON MAP NOW</p></div>
            <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{baseMatching.length}</p><p className="text-[9px] text-slate-500">TOTAL MATCHES</p></div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-xl border px-2 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide">Map health</span>
            <span className={`text-[10px] font-black uppercase ${mapHealth === "healthy" ? "text-emerald-600" : mapHealth === "degraded" ? "text-amber-600" : "text-slate-500"}`}>{mapHealth}</span>
          </div>
          {unmappedMatching > 0 && <p className="mt-2 leading-relaxed text-amber-700 dark:text-amber-300">{unmappedMatching} matching listing{unmappedMatching === 1 ? " is" : "s are"} still discoverable in Find My Res while coordinates are being verified.</p>}
        </div>
      </div>

      {mapHealth === "degraded" && !mapError && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-20 w-[calc(100%-24px)] max-w-lg -translate-x-1/2 rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-lg backdrop-blur">
          A basemap provider is slow or blocked. ResMap is keeping the coordinate layer alive and automatically using its secondary map tiles.
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 right-3 z-30 w-[calc(100%-24px)] sm:bottom-5 sm:right-5 sm:w-auto">
        {selectedResidence && (
          <ResMapResidenceCard
            residence={selectedResidence}
            routeInfo={routeInfo}
            nearby={[]}
            travelMode={travelMode}
            onRoute={() => void requestRoute()}
            onClose={() => {
              setSelectedResidence(null);
              setRouteInfo(null);
              if (engine === "reskonnect") mapRef.current?.getSource("resmap-route")?.setData(featureCollection([]));
            }}
          />
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 z-30 flex gap-2 md:hidden">
        <Button className="rounded-full shadow-xl" onClick={() => setControlsOpen(true)}><SlidersHorizontal className="mr-2 h-4 w-4" />Map controls</Button>
        {engine === "reskonnect" && <Button variant="secondary" className="rounded-full shadow-xl" onClick={() => setIs3d((value) => !value)}><Compass className="mr-2 h-4 w-4" />{is3d ? "3D" : "2D"}</Button>}
        {google3dReady && <Button variant="secondary" className="rounded-full shadow-xl" onClick={switchEngine}>{engine === "google3d" ? "Map" : "Google 3D"}</Button>}
      </div>

      {controlsOpen && (
        <div className="absolute inset-0 z-50 bg-black/30 md:hidden" onClick={() => setControlsOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-lg font-black">ResMap controls</p><p className="text-xs text-slate-500">Campus orbit, travel time and live accommodation filters</p></div>
              <button className="grid h-9 w-9 place-items-center rounded-full border" onClick={() => setControlsOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <Controls />
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 top-16 z-40 grid place-items-center bg-slate-950/92 p-6 text-center text-white">
          <div>
            <MapPinned className="mx-auto h-12 w-12 text-cyan-400" />
            <h3 className="mt-4 text-xl font-black">ResMap could not initialize</h3>
            <p className="mt-2 max-w-md text-sm text-white/70">{mapError}</p>
            <div className="mt-4 flex justify-center gap-2">
              {engine !== "reskonnect" && <Button variant="secondary" onClick={() => { setMapError(null); setEngine("reskonnect"); }}>Use ResKonnect map</Button>}
              <Button variant="secondary" onClick={onClose}>Return to Find My Res</Button>
            </div>
          </div>
        </div>
      )}

      {!mapReady && !mapError && (
        <div className="pointer-events-none absolute inset-0 top-16 z-10 grid place-items-center bg-slate-100/50">
          <div className="rounded-2xl bg-white/95 px-5 py-3 text-sm font-bold text-slate-900 shadow-xl backdrop-blur">
            <Sparkles className="mr-2 inline h-4 w-4 animate-pulse text-blue-600" />Connecting live accommodation coordinates…
          </div>
        </div>
      )}
      {loading && <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-900 shadow">Syncing live residence inventory…</div>}
    </div>
  );
}
