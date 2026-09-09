import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Loader2, MapPinned, Rotate3D, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import ResMapExperiencePremiumV2 from "./ResMapExperiencePremiumV2";

interface Props {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resetFilters: () => void;
  onClose: () => void;
}

interface MapConfig {
  google_maps_enabled: boolean;
  google_maps_browser_key?: string | null;
  google_maps_map_id?: string | null;
}

type PointRow = {
  id: string;
  name: string;
  latitude: number | string | null;
  longitude: number | string | null;
};

type ThreeDStatus = "idle" | "loading" | "ready" | "failed";
type ThreeDEngine = "photorealistic" | "vector" | null;

const PRETORIA = { lat: -25.7479, lng: 28.2293, altitude: 250 };
let mapsLoader: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const scriptId = "resmap-google-maps-js";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const finish = () => {
      if (!w.google?.maps?.importLibrary) {
        reject(new Error("Google Maps did not initialize"));
        return;
      }
      resolve(w.google);
    };

    if (existing) {
      if (w.google?.maps?.importLibrary) return finish();
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.onload = finish;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  }).catch((error) => {
    mapsLoader = null;
    throw error;
  });

  return mapsLoader;
}

function validPoint(row: PointRow) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35.5 && lat <= -21 && lng >= 15 && lng <= 34;
}

function preferredCenter(points: PointRow[]) {
  const preferred = points.find((row) => {
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    return lat > -26.2 && lat < -25.2 && lng > 27.6 && lng < 28.8;
  }) || points[0];
  if (!preferred) return PRETORIA;
  return { lat: Number(preferred.latitude), lng: Number(preferred.longitude), altitude: 250 };
}

function waitFor3DReady(map3d: any, timeoutMs = 12000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timer = 0;

    const cleanup = () => {
      window.clearTimeout(timer);
      try { map3d.removeEventListener("gmp-steadychange", onSteady); } catch { /* no-op */ }
      try { map3d.removeEventListener("gmp-steadystate", onSteady); } catch { /* no-op */ }
      try { map3d.removeEventListener("gmp-error", onError); } catch { /* no-op */ }
      try { map3d.removeEventListener("gmp-map-id-error", onMapIdError); } catch { /* no-op */ }
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const onSteady = (event: any) => {
      if (event?.isSteady === false) return;
      finish();
    };
    const onError = () => finish(new Error("Google Photorealistic 3D failed to initialize"));
    const onMapIdError = () => finish(new Error("Google Maps rejected the configured 3D map ID"));

    map3d.addEventListener("gmp-steadychange", onSteady);
    map3d.addEventListener("gmp-steadystate", onSteady);
    map3d.addEventListener("gmp-error", onError);
    map3d.addEventListener("gmp-map-id-error", onMapIdError);
    timer = window.setTimeout(() => finish(new Error("Photorealistic 3D render timed out")), timeoutMs);
  });
}

function waitForVectorTiles(google: any, map: any, timeoutMs = 9000) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Vector 3D tiles timed out"));
    }, timeoutMs);
    google.maps.event.addListenerOnce(map, "tilesloaded", () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve();
    });
  });
}

function ThreeDOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<any[]>([]);
  const [status, setStatus] = useState<ThreeDStatus>("idle");
  const [engine, setEngine] = useState<ThreeDEngine>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !nodeRef.current) return;
    let disposed = false;
    setStatus("loading");
    setEngine(null);
    setSelectedName(null);
    setFailureMessage(null);

    (async () => {
      const [configResult, residenceResult] = await Promise.all([
        (supabase as any).from("resmap_map_config")
          .select("google_maps_enabled,google_maps_browser_key,google_maps_map_id")
          .eq("id", 1)
          .maybeSingle(),
        (supabase as any).from("residences")
          .select("id,name,latitude,longitude")
          .eq("is_visible", true)
          .limit(180),
      ]);

      if (disposed || !nodeRef.current) return;
      const config = configResult.data as MapConfig | null;
      if (!config?.google_maps_enabled || !config.google_maps_browser_key) {
        throw new Error("Google Maps 3D is not configured");
      }

      const points = ((residenceResult.data || []) as PointRow[]).filter(validPoint);
      const center = preferredCenter(points);
      const google = await loadGoogleMaps(config.google_maps_browser_key);
      if (disposed || !nodeRef.current) return;

      try {
        const maps3d = await google.maps.importLibrary("maps3d");
        if (disposed || !nodeRef.current) return;
        const Map3DElement = maps3d.Map3DElement;
        const Marker3DInteractiveElement = maps3d.Marker3DInteractiveElement;
        if (!Map3DElement) throw new Error("Map3DElement unavailable");

        const map3d = new Map3DElement({
          center,
          tilt: 67.5,
          heading: 0,
          range: 7200,
          mode: "HYBRID",
          gestureHandling: "GREEDY",
          defaultUIHidden: false,
          ...(config.google_maps_map_id ? { mapId: config.google_maps_map_id } : {}),
        });
        map3d.style.width = "100%";
        map3d.style.height = "100%";

        const readyPromise = waitFor3DReady(map3d);
        nodeRef.current.replaceChildren(map3d);
        await readyPromise;
        if (disposed) return;

        if (Marker3DInteractiveElement) {
          markerRefs.current = points.slice(0, 90).map((row) => {
            const marker = new Marker3DInteractiveElement({
              position: { lat: Number(row.latitude), lng: Number(row.longitude), altitude: 0 },
              label: row.name.slice(0, 32),
              title: row.name,
              extruded: true,
              sizePreserved: true,
            });
            marker.addEventListener("gmp-click", () => setSelectedName(row.name));
            map3d.append(marker);
            return marker;
          });
        }

        setEngine("photorealistic");
        setStatus("ready");
        return;
      } catch (photorealError) {
        console.warn("Photorealistic ResMap 3D unavailable; switching to vector 3D", photorealError);
        markerRefs.current.forEach((marker) => { try { marker.remove?.(); } catch { /* no-op */ } });
        markerRefs.current = [];
      }

      const mapsLibrary = await google.maps.importLibrary("maps");
      if (disposed || !nodeRef.current) return;
      const host = document.createElement("div");
      host.style.width = "100%";
      host.style.height = "100%";
      nodeRef.current.replaceChildren(host);

      const map = new mapsLibrary.Map(host, {
        center: { lat: center.lat, lng: center.lng },
        zoom: 17,
        mapTypeId: "hybrid",
        renderingType: mapsLibrary.RenderingType?.VECTOR,
        tilt: 55,
        heading: 0,
        tiltInteractionEnabled: true,
        headingInteractionEnabled: true,
        gestureHandling: "greedy",
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControl: false,
      });

      await waitForVectorTiles(google, map);
      if (disposed) return;
      try { map.moveCamera({ center: { lat: center.lat, lng: center.lng }, zoom: 17, tilt: 55, heading: 0 }); } catch { /* no-op */ }

      const Marker = google.maps.Marker;
      if (Marker) {
        markerRefs.current = points.slice(0, 60).map((row) => {
          const marker = new Marker({
            map,
            position: { lat: Number(row.latitude), lng: Number(row.longitude) },
            title: row.name,
          });
          marker.addListener("click", () => setSelectedName(row.name));
          return marker;
        });
      }

      setEngine("vector");
      setStatus("ready");
    })().catch((error) => {
      if (disposed) return;
      console.error("ResMap 3D failed", error);
      setFailureMessage(error instanceof Error ? error.message : "3D engine could not initialize");
      setStatus("failed");
    });

    return () => {
      disposed = true;
      markerRefs.current.forEach((marker) => {
        try {
          if (typeof marker.remove === "function") marker.remove();
          else if (typeof marker.setMap === "function") marker.setMap(null);
        } catch { /* no-op */ }
      });
      markerRefs.current = [];
      nodeRef.current?.replaceChildren();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[280] overflow-hidden bg-slate-950 text-white">
      <div ref={nodeRef} className="absolute inset-0 bg-slate-950" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-3 pt-[calc(10px+env(safe-area-inset-top))] sm:px-5">
        <div className="pointer-events-auto rounded-[22px] border border-white/20 bg-slate-950/78 px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Rotate3D className="h-5 w-5 text-cyan-300" />
            <p className="font-black">ResMap 3D</p>
            <Badge className="bg-cyan-500 text-white">{engine === "vector" ? "VECTOR 3D" : "PHOTOREAL"}</Badge>
          </div>
          <p className="mt-1 max-w-[68vw] text-[11px] text-white/70">
            {engine === "vector"
              ? "Interactive vector 3D fallback. Drag, rotate, tilt and zoom."
              : "Photorealistic Google 3D where coverage is available. Drag to orbit, pinch to zoom and explore freely."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-slate-950/80 shadow-xl backdrop-blur" aria-label="Close 3D view">
          <X className="h-5 w-5" />
        </button>
      </header>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-sm font-bold shadow-xl backdrop-blur"><Loader2 className="h-4 w-4 animate-spin" />Loading ResMap 3D…</div>
        </div>
      )}

      {status === "failed" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6">
          <div className="max-w-md rounded-[28px] border border-white/15 bg-slate-950/90 p-6 text-center shadow-2xl backdrop-blur-xl">
            <Box className="mx-auto h-9 w-9 text-cyan-300" />
            <h2 className="mt-3 text-xl font-black">3D could not initialize on this device</h2>
            <p className="mt-2 text-sm text-white/70">ResMap attempted Photorealistic 3D and the WebGL vector fallback. The live 2D map remains available.</p>
            {failureMessage && <p className="mt-2 text-[11px] text-white/45">{failureMessage}</p>}
            <Button onClick={onClose} className="mt-5 bg-white text-slate-950 hover:bg-white/90">Return to ResMap</Button>
          </div>
        </div>
      )}

      {selectedName && status === "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(18px+env(safe-area-inset-bottom))] z-20 flex justify-center px-4">
          <div className="rounded-full border border-white/20 bg-slate-950/80 px-4 py-2 text-sm font-bold shadow-xl backdrop-blur-xl"><MapPinned className="mr-2 inline h-4 w-4 text-cyan-300" />{selectedName}</div>
        </div>
      )}
    </div>
  );
}

export default function ResMapExperiencePremiumV4(props: Props) {
  const [threeDOpen, setThreeDOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("mode") === "3d";
  });

  const set3D = useCallback((value: boolean) => {
    setThreeDOpen(value);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("mode", "3d");
    else url.searchParams.delete("mode");
    window.history.replaceState({}, "", url);
  }, []);

  return (
    <>
      <ResMapExperiencePremiumV2 {...props} />
      <button
        type="button"
        onClick={() => set3D(true)}
        className="fixed bottom-[calc(82px+env(safe-area-inset-bottom))] right-3 z-[230] inline-flex h-12 items-center gap-2 rounded-full border border-white/80 bg-slate-950 px-4 text-sm font-black text-white shadow-2xl sm:right-5"
        aria-label="Open 3D ResMap"
      >
        <Rotate3D className="h-5 w-5 text-cyan-300" />3D
      </button>
      <ThreeDOverlay open={threeDOpen} onClose={() => set3D(false)} />
    </>
  );
}
