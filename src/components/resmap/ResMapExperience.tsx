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
  geocode_status?: string;
}

interface NearbyPlace { name: string; kind: string; distanceKm?: number; }
interface RouteInfo { distance_m: number; duration_s: number; provider: string; profile: TravelMode; geometry?: any; }

const SOUTH_AFRICA_CENTER: [number, number] = [25.45, -28.55];
const OPENFREE_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const validCoord = (r: any) => Number.isFinite(Number(r?.latitude)) && Number.isFinite(Number(r?.longitude)) && Number(r.latitude) >= -35.5 && Number(r.latitude) <= -21 && Number(r.longitude) >= 15 && Number(r.longitude) <= 34;
const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function featureCollection(features: any[]) { return { type: "FeatureCollection", features }; }
function pointFeature(lng: number, lat: number, properties: any) { return { type: "Feature", properties, geometry: { type: "Point", coordinates: [lng, lat] } }; }

function classifyPlace(feature: any) {
  const text = normalize([feature?.properties?.class, feature?.properties?.subclass, feature?.properties?.amenity, feature?.properties?.type, feature?.layer?.id, feature?.properties?.name].filter(Boolean).join(" "));
  if (/hospital|clinic|pharmacy|doctor|health/.test(text)) return "health";
  if (/bus|taxi|rail|station|transport|subway|tram/.test(text)) return "transport";
  if (/supermarket|mall|shop|market|retail/.test(text)) return "shopping";
  if (/restaurant|cafe|fast food|food|bar/.test(text)) return "food";
  if (/police|security|fire station/.test(text)) return "safety";
  if (/school|college|university|library/.test(text)) return "education";
  return "nearby";
}

function campusMatchesHint(campus: Campus, hint: string) {
  const hay = [campus.name, campus.short_name, ...(campus.aliases || [])].map(normalize).join(" | ");
  const needle = normalize(hint);
  return hay.includes(needle) || needle.includes(normalize(campus.short_name)) || needle.split(" ").filter((x) => x.length > 2).every((x) => hay.includes(x));
}

export default function ResMapExperience({ filters, updateFilter, resetFilters, onClose }: Props) {
  const { residences, loading } = useRealtimeResidences();
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const residencesRef = useRef<Map<string, any>>(new Map());
  const selectedRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [selectedCampusKey, setSelectedCampusKey] = useState("");
  const [orbitRadiusKm, setOrbitRadiusKm] = useState(3);
  const [travelMode, setTravelMode] = useState<TravelMode>("walk");
  const [travelTimeMax, setTravelTimeMax] = useState(0);
  const [selectedResidence, setSelectedResidence] = useState<any | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [nearby, setNearby] = useState<NearbyPlace[]>([]);
  const [is3d, setIs3d] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("Ask Dimpho to reshape the map around what you need.");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any).from("resmap_campuses").select("id,campus_key,name,short_name,aliases,latitude,longitude,geocode_status").eq("is_active", true).order("name");
      if (active) setCampuses((data || []).filter((c: Campus) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))));
    })();
    return () => { active = false; };
  }, []);

  const selectedCampus = useMemo(() => campuses.find((campus) => campus.campus_key === selectedCampusKey) || null, [campuses, selectedCampusKey]);

  useEffect(() => {
    if (!campuses.length || filters.campus === "all") return;
    const match = campuses.find((campus) => campusMatchesHint(campus, filters.campus));
    if (match && match.campus_key !== selectedCampusKey) setSelectedCampusKey(match.campus_key);
  }, [campuses, filters.campus, selectedCampusKey]);

  const baseMatching = useMemo(() => residences.filter((r: any) => !isMockResidence(r) && residenceMatchesMapFilters(r, filters)), [residences, filters]);
  const mappedMatching = useMemo(() => baseMatching.filter(validCoord), [baseMatching]);

  const displayedMapped = useMemo(() => {
    if (!selectedCampus || !Number.isFinite(Number(selectedCampus.latitude)) || !Number.isFinite(Number(selectedCampus.longitude))) return mappedMatching;
    const origin = { latitude: Number(selectedCampus.latitude), longitude: Number(selectedCampus.longitude) };
    return mappedMatching.filter((r: any) => {
      const km = haversineKm(origin, { latitude: Number(r.latitude), longitude: Number(r.longitude) });
      if (orbitRadiusKm > 0 && km > orbitRadiusKm) return false;
      if (travelTimeMax > 0 && estimateTravelMinutes(km, travelMode) > travelTimeMax) return false;
      return true;
    });
  }, [mappedMatching, selectedCampus, orbitRadiusKm, travelMode, travelTimeMax]);

  const unmappedMatching = baseMatching.length - mappedMatching.length;
  const allMapped = useMemo(() => residences.filter((r: any) => !isMockResidence(r) && validCoord(r) && r.map_hidden !== true && r.is_visible !== false), [residences]);
  const mapReadiness = residences.length ? Math.round(allMapped.length / residences.filter((r: any) => !isMockResidence(r)).length * 100) : 0;

  useEffect(() => { residencesRef.current = new Map(residences.map((r: any) => [String(r.id), r])); }, [residences]);
  useEffect(() => { selectedRef.current = selectedResidence; }, [selectedResidence]);

  const scanNearby = useCallback(() => {
    const map = mapRef.current;
    const residence = selectedRef.current;
    if (!map || !residence || !validCoord(residence)) return;
    try {
      const center = map.project([Number(residence.longitude), Number(residence.latitude)]);
      const box: [[number, number], [number, number]] = [[center.x - 250, center.y - 250], [center.x + 250, center.y + 250]];
      const features = map.queryRenderedFeatures(box);
      const seen = new Set<string>();
      const result: NearbyPlace[] = [];
      for (const feature of features) {
        const name = String(feature?.properties?.name || feature?.properties?.name_en || "").trim();
        if (!name || seen.has(name.toLowerCase()) || String(feature?.layer?.id || "").startsWith("resmap-")) continue;
        if (feature?.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) continue;
        const [lng, lat] = feature.geometry.coordinates;
        if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) continue;
        const distanceKm = haversineKm({ latitude: Number(residence.latitude), longitude: Number(residence.longitude) }, { latitude: Number(lat), longitude: Number(lng) });
        if (distanceKm > 3) continue;
        seen.add(name.toLowerCase());
        result.push({ name, kind: classifyPlace(feature), distanceKm });
      }
      result.sort((a, b) => (a.distanceKm || 99) - (b.distanceKm || 99));
      setNearby(result.slice(0, 10));
    } catch { setNearby([]); }
  }, []);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    let disposed = false;
    let map: any;
    loadMapLibre().then((maplibregl) => {
      if (disposed || !mapNode.current) return;
      map = new maplibregl.Map({
        container: mapNode.current,
        style: OPENFREE_STYLE,
        center: SOUTH_AFRICA_CENTER,
        zoom: 5.2,
        pitch: 52,
        bearing: -12,
        attributionControl: true,
        maxPitch: 75,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.on("load", () => {
        if (disposed) return;
        try {
          const style = map.getStyle();
          const vectorSource = Object.entries(style.sources || {}).find(([, value]: any) => value?.type === "vector")?.[0];
          const hasExtrusion = (style.layers || []).some((layer: any) => layer.type === "fill-extrusion");
          if (vectorSource && !hasExtrusion) {
            const firstLabel = (style.layers || []).find((layer: any) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
            map.addLayer({ id: "resmap-3d-buildings", source: vectorSource, "source-layer": "building", minzoom: 13.5, type: "fill-extrusion", paint: { "fill-extrusion-color": ["interpolate", ["linear"], ["zoom"], 13.5, "#dce5eb", 17, "#c6d2dc"], "fill-extrusion-height": ["coalesce", ["get", "render_height"], ["get", "height"], 8], "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.82 } }, firstLabel);
          }
        } catch { /* base style may already provide 3D */ }

        map.addSource("resmap-residences", { type: "geojson", data: featureCollection([]), cluster: true, clusterMaxZoom: 13, clusterRadius: 46 });
        map.addLayer({ id: "resmap-clusters", type: "circle", source: "resmap-residences", filter: ["has", "point_count"], paint: { "circle-color": ["step", ["get", "point_count"], "#0f6fff", 20, "#0959c7", 60, "#073d88"], "circle-radius": ["step", ["get", "point_count"], 22, 20, 28, 60, 34], "circle-stroke-color": "#ffffff", "circle-stroke-width": 3, "circle-opacity": 0.94 } });
        map.addLayer({ id: "resmap-cluster-count", type: "symbol", source: "resmap-residences", filter: ["has", "point_count"], layout: { "text-field": "{point_count_abbreviated}", "text-size": 12, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#ffffff" } });
        map.addLayer({ id: "resmap-residence-glow", type: "circle", source: "resmap-residences", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 8, 15, 15], "circle-color": "#15c9d5", "circle-opacity": 0.18, "circle-blur": 0.5 } });
        map.addLayer({ id: "resmap-residence-points", type: "circle", source: "resmap-residences", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4.5, 15, 8.5], "circle-color": ["match", ["get", "availability"], "available", "#10b981", "limited", "#f59e0b", "#2563eb"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
        map.addLayer({ id: "resmap-price-labels", type: "symbol", source: "resmap-residences", filter: ["!", ["has", "point_count"]], minzoom: 12, layout: { "text-field": ["get", "priceLabel"], "text-size": 11, "text-offset": [0, 1.5], "text-anchor": "top", "text-allow-overlap": false }, paint: { "text-color": "#07192e", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
        map.addSource("resmap-campuses", { type: "geojson", data: featureCollection([]) });
        map.addLayer({ id: "resmap-campus-points", type: "circle", source: "resmap-campuses", paint: { "circle-radius": ["case", ["get", "selected"], 11, 7], "circle-color": ["case", ["get", "selected"], "#7c3aed", "#111827"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
        map.addLayer({ id: "resmap-campus-labels", type: "symbol", source: "resmap-campuses", minzoom: 8, layout: { "text-field": ["get", "label"], "text-size": 11, "text-offset": [0, 1.6], "text-anchor": "top" }, paint: { "text-color": "#111827", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
        map.addSource("resmap-orbit", { type: "geojson", data: featureCollection([]) });
        map.addLayer({ id: "resmap-orbit-fill", type: "fill", source: "resmap-orbit", paint: { "fill-color": "#7c3aed", "fill-opacity": 0.025 } });
        map.addLayer({ id: "resmap-orbit-line", type: "line", source: "resmap-orbit", paint: { "line-color": "#7c3aed", "line-width": 1.5, "line-opacity": 0.5, "line-dasharray": [2, 2] } });
        map.addSource("resmap-route", { type: "geojson", data: featureCollection([]) });
        map.addLayer({ id: "resmap-route-glow", type: "line", source: "resmap-route", paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.8 } });
        map.addLayer({ id: "resmap-route-line", type: "line", source: "resmap-route", paint: { "line-color": "#0f6fff", "line-width": 5, "line-opacity": 0.95 } });
        map.addSource("resmap-selected", { type: "geojson", data: featureCollection([]) });
        map.addLayer({ id: "resmap-selected-ring", type: "circle", source: "resmap-selected", paint: { "circle-radius": 15, "circle-color": "rgba(255,255,255,0)", "circle-stroke-color": "#0f6fff", "circle-stroke-width": 4 } });

        map.on("click", "resmap-residence-points", (event: any) => {
          const feature = event.features?.[0];
          const id = String(feature?.properties?.id || "");
          const residence = residencesRef.current.get(id);
          if (!residence) return;
          setSelectedResidence(residence); setRouteInfo(null); setNearby([]);
          map.flyTo({ center: [Number(residence.longitude), Number(residence.latitude)], zoom: Math.max(map.getZoom(), 15), pitch: 58, duration: 900 });
          window.setTimeout(scanNearby, 1100);
        });
        map.on("click", "resmap-clusters", async (event: any) => {
          const feature = event.features?.[0]; const clusterId = feature?.properties?.cluster_id; const coordinates = feature?.geometry?.coordinates;
          if (clusterId == null || !coordinates) return;
          try { const source = map.getSource("resmap-residences"); const zoom = await source.getClusterExpansionZoom(clusterId); map.easeTo({ center: coordinates, zoom: Math.min(zoom, 16), duration: 600 }); } catch { map.easeTo({ center: coordinates, zoom: map.getZoom() + 2 }); }
        });
        for (const layer of ["resmap-residence-points", "resmap-clusters"]) { map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; }); map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; }); }
        map.on("moveend", () => { if (selectedRef.current) scanNearby(); });
        setMapReady(true);
      });
      map.on("error", (event: any) => { if (!mapReady && event?.error?.message) setMapError(event.error.message); });
    }).catch((error) => setMapError(error instanceof Error ? error.message : String(error)));
    return () => { disposed = true; if (map) map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("resmap-residences");
    if (!source) return;
    source.setData(featureCollection(displayedMapped.map((r: any) => {
      const spots = Number(r.available_spots || 0);
      const price = Number(r.private_price || r.price || r.nsfas_price || 0);
      return pointFeature(Number(r.longitude), Number(r.latitude), { id: String(r.id), name: r.name, priceLabel: price > 0 ? `R${Math.round(price)}` : "View", availability: spots > 5 ? "available" : spots > 0 ? "limited" : "unknown", nsfas: Boolean(r.accepts_nsfas || r.is_tut_accredited) });
    })));
  }, [displayedMapped, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("resmap-campuses");
    if (!source) return;
    source.setData(featureCollection(campuses.filter((c) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude))).map((c) => pointFeature(Number(c.longitude), Number(c.latitude), { id: c.campus_key, label: c.short_name || c.name, selected: c.campus_key === selectedCampusKey }))));
  }, [campuses, selectedCampusKey, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("resmap-orbit");
    if (!source) return;
    if (!selectedCampus) { source.setData(featureCollection([])); return; }
    const lat = Number(selectedCampus.latitude), lng = Number(selectedCampus.longitude);
    const radii = [0.5, 1, 2, 3, 5].filter((r) => r <= Math.max(3, orbitRadiusKm || 0));
    source.setData(featureCollection(radii.map((radius) => circlePolygon(lat, lng, radius))));
    const zoom = orbitRadiusKm === 0 ? 11 : orbitRadiusKm <= 0.5 ? 15.2 : orbitRadiusKm <= 1 ? 14.4 : orbitRadiusKm <= 2 ? 13.4 : orbitRadiusKm <= 3 ? 12.8 : 12;
    mapRef.current.flyTo({ center: [lng, lat], zoom, pitch: is3d ? 55 : 0, duration: 850 });
  }, [selectedCampus, orbitRadiusKm, mapReady, is3d]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    try {
      const layer = mapRef.current.getLayer("resmap-3d-buildings");
      if (layer) mapRef.current.setLayoutProperty("resmap-3d-buildings", "visibility", is3d ? "visible" : "none");
      mapRef.current.easeTo({ pitch: is3d ? 55 : 0, bearing: is3d ? -12 : 0, duration: 500 });
    } catch { /* optional extrusion */ }
  }, [is3d, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("resmap-selected");
    if (!source) return;
    source.setData(selectedResidence && validCoord(selectedResidence) ? featureCollection([pointFeature(Number(selectedResidence.longitude), Number(selectedResidence.latitude), { id: selectedResidence.id })]) : featureCollection([]));
  }, [selectedResidence, mapReady]);

  const chooseCampus = (campusKey: string) => {
    setSelectedCampusKey(campusKey);
    const campus = campuses.find((c) => c.campus_key === campusKey);
    if (campus) updateFilter("campus", campusFilterValue(campus)); else updateFilter("campus", "all");
    setSelectedResidence(null); setRouteInfo(null);
  };

  const locateMe = () => {
    if (!navigator.geolocation) { toast.error("Location is not available on this device"); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setUserLocation(next);
      mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 14.5, pitch: is3d ? 50 : 0, duration: 800 });
      toast.success("Map centered on your current location");
    }, () => toast.error("Location permission was not granted"), { enableHighAccuracy: true, timeout: 8000 });
  };

  const requestRoute = async () => {
    if (!selectedResidence || !validCoord(selectedResidence)) return;
    const origin = selectedCampus ? { lat: Number(selectedCampus.latitude), lng: Number(selectedCampus.longitude) } : userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null;
    if (!origin) { toast.info("Choose a campus or tap Locate me first so ResMap knows where your journey starts."); return; }
    const destination = { lat: Number(selectedResidence.latitude), lng: Number(selectedResidence.longitude) };
    toast.loading("Building your route…", { id: "resmap-route" });
    const { data, error } = await supabase.functions.invoke("resmap-spatial", { body: { action: "route", origin, destination, profile: travelMode } });
    if (error || !data?.ok) { toast.error(data?.error || error?.message || "Could not build route", { id: "resmap-route" }); return; }
    const info: RouteInfo = { distance_m: Number(data.distance_m), duration_s: Number(data.duration_s), provider: String(data.provider), profile: travelMode, geometry: data.geometry };
    setRouteInfo(info);
    const source = mapRef.current?.getSource("resmap-route");
    if (source && data.geometry) source.setData(featureCollection([{ type: "Feature", properties: {}, geometry: data.geometry }]));
    const coords = data.geometry?.coordinates || [];
    if (coords.length > 1 && mapRef.current) {
      const maplibregl = window.maplibregl;
      const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
      coords.forEach((coord: number[]) => bounds.extend(coord));
      mapRef.current.fitBounds(bounds, { padding: { top: 150, right: 70, bottom: selectedResidence ? 270 : 80, left: 70 }, maxZoom: 15.5, duration: 800 });
    }
    toast.success(`${Math.max(1, Math.round(info.duration_s / 60))} min · ${(info.distance_m / 1000).toFixed(1)} km`, { id: "resmap-route" });
  };

  const applyCampusHint = (hint?: string | null) => {
    if (!hint) return false;
    const campus = campuses.find((c) => campusMatchesHint(c, hint));
    if (campus) { chooseCampus(campus.campus_key); return true; }
    updateFilter("campus", hint as any); return false;
  };

  const applyAiResult = (result: any) => {
    if (!result) return;
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
        toast.success("ResMap updated without using an AI request");
      } else {
        const { data, error } = await supabase.functions.invoke("resmap-spatial", { body: { action: "ai_intent", query } });
        if (error || !data?.ok) throw new Error(data?.error || error?.message || "AI map search failed");
        applyAiResult(data.filters);
        setAiSummary(data.filters?.summary || "Dimpho updated the map.");
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

  const modeButtons: Array<{ mode: TravelMode; label: string; icon: any }> = [
    { mode: "walk", label: "Walk", icon: Footprints }, { mode: "bike", label: "Bike", icon: Bike }, { mode: "drive", label: "Drive", icon: Car }, { mode: "transport", label: "Transport", icon: Bus },
  ];

  const Controls = () => <div className="space-y-4">
    <div>
      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Campus Orbit</p><Badge variant="outline">{displayedMapped.length} mapped</Badge></div>
      <select value={selectedCampusKey} onChange={(e) => chooseCampus(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold text-slate-900 outline-none dark:bg-slate-900 dark:text-white">
        <option value="">All mapped areas</option>{campuses.map((campus) => <option key={campus.id} value={campus.campus_key}>{campus.name}</option>)}
      </select>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{[0, 0.5, 1, 2, 3, 5].map((radius) => <button key={radius} onClick={() => setOrbitRadiusKm(radius)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${orbitRadiusKm === radius ? "bg-violet-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>{radius === 0 ? "Any" : `${radius} km`}</button>)}</div>
    </div>
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Travel-time search</p>
      <div className="grid grid-cols-4 gap-1.5">{modeButtons.map(({ mode, label, icon: Icon }) => <button key={mode} onClick={() => setTravelMode(mode)} className={`rounded-xl px-1 py-2 text-[10px] font-bold ${travelMode === mode ? "bg-[#07192e] text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">{[0, 10, 15, 20, 30, 45].map((minutes) => <button key={minutes} onClick={() => setTravelTimeMax(minutes)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${travelTimeMax === minutes ? "bg-cyan-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}>{minutes === 0 ? "Any time" : `≤ ${minutes} min`}</button>)}</div>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Time filters use spatial estimates for instant filtering. Selecting Route uses the road network and cached routing.</p>
    </div>
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Live Find My Res filters</p>
      <div className="flex flex-wrap gap-1.5">{quickFilters.map(({ label, active, icon: Icon, action }) => <button key={label} onClick={action} className={`rounded-full px-3 py-1.5 text-xs font-bold ${active ? "bg-blue-600 text-white" : "border bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}><Icon className="mr-1 inline h-3.5 w-3.5" />{label}</button>)}</div>
      <label className="mt-3 block text-[11px] font-bold text-slate-600 dark:text-slate-300">Max rent: R{filters.priceMax.toLocaleString("en-ZA")}</label>
      <input type="range" min={1500} max={10000} step={250} value={filters.priceMax} onChange={(e) => updateFilter("priceMax", Number(e.target.value))} className="mt-1 w-full accent-blue-600" />
      <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { resetFilters(); setSelectedCampusKey(""); setTravelTimeMax(0); setOrbitRadiusKm(3); }}>Reset map search</Button>
    </div>
  </div>;

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950 text-slate-950 dark:text-white">
      <div ref={mapNode} className="absolute inset-0 top-[64px]" />

      <header className="absolute inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/60 bg-white/92 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white dark:bg-slate-900" aria-label="Close ResMap"><X className="h-5 w-5" /></button><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-lg font-black sm:text-xl">ResMap</h2><Badge className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">LIVE</Badge></div><p className="truncate text-[11px] text-slate-500">Spatial accommodation discovery · {mapReadiness}% geo-ready</p></div></div>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setIs3d((v) => !v)}><Rotate3D className="mr-1.5 h-4 w-4" />{is3d ? "3D" : "2D"}</Button><Button variant="outline" size="icon" onClick={locateMe} aria-label="Use my location"><LocateFixed className="h-4 w-4" /></Button></div>
      </header>

      <div className="pointer-events-none absolute left-1/2 top-[76px] z-30 w-[calc(100%-24px)] max-w-2xl -translate-x-1/2">
        <div className="pointer-events-auto rounded-[20px] border border-white/70 bg-white/94 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/94">
          <div className="flex gap-2"><div className="relative flex-1"><Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" /><Input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void runAiSearch(); }} placeholder='Ask Dimpho: “NSFAS single room within 15 min walk of Soshanguve North”' className="h-11 border-0 bg-slate-50 pl-9 text-sm shadow-none dark:bg-slate-900" /></div><Button className="h-11 shrink-0" onClick={() => void runAiSearch()} disabled={aiLoading}>{aiLoading ? "Thinking…" : <><Search className="mr-1.5 h-4 w-4" />Search</>}</Button></div>
          <p className="mt-1.5 truncate px-2 text-[10px] text-slate-500">{aiSummary}</p>
        </div>
      </div>

      <aside className="pointer-events-auto absolute left-4 top-[158px] z-20 hidden w-[300px] rounded-[24px] border border-white/70 bg-white/94 p-4 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/94 md:block"><Controls /></aside>

      <div className="pointer-events-none absolute right-3 top-[158px] z-20 hidden max-w-[240px] gap-2 lg:flex lg:flex-col">
        <div className="pointer-events-auto rounded-2xl border border-white/70 bg-white/94 p-3 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-950/94"><div className="flex items-center gap-2 font-bold"><Layers3 className="h-4 w-4 text-blue-600" />Live spatial inventory</div><div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{displayedMapped.length}</p><p className="text-[9px] text-slate-500">ON MAP NOW</p></div><div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900"><p className="text-lg font-black">{baseMatching.length}</p><p className="text-[9px] text-slate-500">TOTAL MATCHES</p></div></div>{unmappedMatching > 0 && <p className="mt-2 leading-relaxed text-amber-700 dark:text-amber-300">{unmappedMatching} matching listing{unmappedMatching === 1 ? " is" : "s are"} still discoverable in Find My Res while map coordinates are being verified.</p>}</div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 z-30 w-[calc(100%-24px)] sm:bottom-5 sm:right-5 sm:w-auto">{selectedResidence && <ResMapResidenceCard residence={selectedResidence} routeInfo={routeInfo} nearby={nearby} travelMode={travelMode} onRoute={() => void requestRoute()} onClose={() => { setSelectedResidence(null); setRouteInfo(null); setNearby([]); mapRef.current?.getSource("resmap-route")?.setData(featureCollection([])); }} />}</div>

      <div className="pointer-events-auto absolute bottom-3 left-3 z-30 flex gap-2 md:hidden"><Button className="rounded-full shadow-xl" onClick={() => setControlsOpen(true)}><SlidersHorizontal className="mr-2 h-4 w-4" />Map controls</Button><Button variant="secondary" className="rounded-full shadow-xl" onClick={() => setIs3d((v) => !v)}><Compass className="mr-2 h-4 w-4" />{is3d ? "3D" : "2D"}</Button></div>

      {controlsOpen && <div className="absolute inset-0 z-50 bg-black/30 md:hidden" onClick={() => setControlsOpen(false)}><div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white p-5 text-slate-950 shadow-2xl dark:bg-slate-950 dark:text-white" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><p className="text-lg font-black">ResMap controls</p><p className="text-xs text-slate-500">Campus orbit, travel time and Find My Res filters</p></div><button className="grid h-9 w-9 place-items-center rounded-full border" onClick={() => setControlsOpen(false)}><X className="h-4 w-4" /></button></div><Controls /></div></div>}

      {mapError && <div className="absolute inset-0 top-16 z-40 grid place-items-center bg-slate-950/90 p-6 text-center text-white"><div><MapPinned className="mx-auto h-12 w-12 text-cyan-400" /><h3 className="mt-4 text-xl font-black">ResMap could not initialize</h3><p className="mt-2 max-w-md text-sm text-white/70">{mapError}</p><Button variant="secondary" className="mt-4" onClick={onClose}>Return to Find My Res</Button></div></div>}
      {!mapReady && !mapError && <div className="pointer-events-none absolute inset-0 top-16 z-10 grid place-items-center bg-slate-950/20"><div className="rounded-2xl bg-white/90 px-5 py-3 text-sm font-bold shadow-xl backdrop-blur"><Sparkles className="mr-2 inline h-4 w-4 animate-pulse text-blue-600" />Building your 3D accommodation map…</div></div>}
      {loading && <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold shadow">Syncing live residence inventory…</div>}
    </div>
  );
}
