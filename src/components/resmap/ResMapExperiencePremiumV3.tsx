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

type ThreeDStatus = "idle" | "loading" | "ready" | "failed";

type PointRow = {
  id: string;
  name: string;
  latitude: number | string | null;
  longitude: number | string | null;
};

const SOUTH_AFRICA = { lat: -28.55, lng: 25.45, altitude: 0 };
let mapsLoader: Promise<any> | null = null;

function normalizedHeading(value: unknown) {
  const heading = Number(value);
  return Number.isFinite(heading) ? (heading + 180 + 360) % 360 : 180;
}

/**
 * The current route engine emits a north-clockwise travel bearing. On the live
 * Street View implementation used by ResMap, the panorama camera is consistently
 * presented 180 degrees opposite that route bearing on affected mobile clients.
 * Patch only the StreetView library surface so maps/markers remain untouched.
 */
function installRealViewHeadingCorrection() {
  if (typeof window === "undefined") return false;
  const maps = (window as any).google?.maps;
  if (!maps?.importLibrary) return false;
  if (maps.__reskonnectRealViewPatched) return true;

  const originalImportLibrary = maps.importLibrary.bind(maps);
  maps.importLibrary = async (libraryName: string, ...args: any[]) => {
    const library = await originalImportLibrary(libraryName, ...args);
    if (libraryName !== "streetView" || !library?.StreetViewPanorama) return library;
    if (maps.__reskonnectRealViewLibrary) return maps.__reskonnectRealViewLibrary;

    const BasePanorama = library.StreetViewPanorama;
    class ResKonnectStreetViewPanorama extends BasePanorama {
      constructor(node: HTMLElement, options: any = {}) {
        const pov = options?.pov
          ? { ...options.pov, heading: normalizedHeading(options.pov.heading), pitch: Number(options.pov.pitch || 0) }
          : options?.pov;
        super(node, { ...options, pov });
      }

      setPov(pov: any) {
        return super.setPov({
          ...pov,
          heading: normalizedHeading(pov?.heading),
          pitch: Number.isFinite(Number(pov?.pitch)) ? Number(pov.pitch) : 0,
        });
      }
    }

    maps.__reskonnectRealViewLibrary = new Proxy(library, {
      get(target, property, receiver) {
        if (property === "StreetViewPanorama") return ResKonnectStreetViewPanorama;
        return Reflect.get(target, property, receiver);
      },
    });
    return maps.__reskonnectRealViewLibrary;
  };

  maps.__reskonnectRealViewPatched = true;
  return true;
}

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) {
    installRealViewHeadingCorrection();
    return Promise.resolve(w.google);
  }
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const scriptId = "resmap-google-maps-js";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    const finish = () => {
      if (!w.google?.maps?.importLibrary) {
        reject(new Error("Google Maps did not initialize"));
        return;
      }
      installRealViewHeadingCorrection();
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

function ThreeDOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const [status, setStatus] = useState<ThreeDStatus>("idle");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !nodeRef.current) return;
    let disposed = false;
    setStatus("loading");
    setSelectedName(null);

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
      if (disposed) return;

      const config = configResult.data as MapConfig | null;
      if (!config?.google_maps_enabled || !config.google_maps_browser_key) {
        throw new Error("Photorealistic 3D is not configured");
      }

      const points = ((residenceResult.data || []) as PointRow[]).filter(validPoint);
      const first = points[0];
      const center = first
        ? { lat: Number(first.latitude), lng: Number(first.longitude), altitude: 0 }
        : SOUTH_AFRICA;

      const google = await loadGoogleMaps(config.google_maps_browser_key);
      const maps3d = await google.maps.importLibrary("maps3d");
      if (disposed || !nodeRef.current) return;

      const Map3DElement = maps3d.Map3DElement;
      const Marker3DInteractiveElement = maps3d.Marker3DInteractiveElement;
      if (!Map3DElement) throw new Error("Google Maps 3D is unavailable in this browser");

      const map3d = new Map3DElement({
        center,
        tilt: 67.5,
        heading: 0,
        range: 9000,
        mode: maps3d.MapMode?.SATELLITE ?? "SATELLITE",
        gestureHandling: maps3d.GestureHandling?.GREEDY ?? "GREEDY",
        defaultUIHidden: false,
        ...(config.google_maps_map_id ? { mapId: config.google_maps_map_id } : {}),
      });
      map3d.style.width = "100%";
      map3d.style.height = "100%";
      nodeRef.current.replaceChildren(map3d);
      mapRef.current = map3d;

      markerRefs.current = [];
      if (Marker3DInteractiveElement) {
        points.slice(0, 140).forEach((row) => {
          const marker = new Marker3DInteractiveElement({
            position: { lat: Number(row.latitude), lng: Number(row.longitude), altitude: 0 },
            label: row.name.slice(0, 42),
            title: row.name,
            extruded: true,
            sizePreserved: true,
          });
          marker.addEventListener("gmp-click", () => setSelectedName(row.name));
          map3d.append(marker);
          markerRefs.current.push(marker);
        });
      }

      setStatus("ready");
    })().catch((error) => {
      if (disposed) return;
      console.error("ResMap photorealistic 3D failed", error);
      setStatus("failed");
    });

    return () => {
      disposed = true;
      markerRefs.current.forEach((marker) => {
        try { marker.remove(); } catch { /* no-op */ }
      });
      markerRefs.current = [];
      if (nodeRef.current) nodeRef.current.replaceChildren();
      mapRef.current = null;
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
            <Badge className="bg-cyan-500 text-white">PHOTOREAL</Badge>
          </div>
          <p className="mt-1 max-w-[68vw] text-[11px] text-white/70">Satellite photorealistic view where Google 3D coverage is available. Drag to orbit, pinch to zoom and explore freely.</p>
        </div>
        <button type="button" onClick={onClose} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-slate-950/80 shadow-xl backdrop-blur" aria-label="Close 3D view">
          <X className="h-5 w-5" />
        </button>
      </header>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-sm font-bold shadow-xl backdrop-blur"><Loader2 className="h-4 w-4 animate-spin" />Loading photorealistic 3D…</div>
        </div>
      )}

      {status === "failed" && (
        <div className="absolute inset-0 z-10 grid place-items-center p-6">
          <div className="max-w-md rounded-[28px] border border-white/15 bg-slate-950/90 p-6 text-center shadow-2xl backdrop-blur-xl">
            <Box className="mx-auto h-9 w-9 text-cyan-300" />
            <h2 className="mt-3 text-xl font-black">3D coverage could not load</h2>
            <p className="mt-2 text-sm text-white/70">The live ResMap remains available. Photorealistic 3D depends on browser support, the Google Maps 3D service and local imagery coverage.</p>
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

export default function ResMapExperiencePremiumV3(props: Props) {
  const [threeDOpen, setThreeDOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("mode") === "3d";
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "reskonnect-realview-native-colour";
    style.textContent = ".gm-style img,.gm-style canvas{filter:none!important;mix-blend-mode:normal!important;color-scheme:normal!important;}";
    document.head.appendChild(style);

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (installRealViewHeadingCorrection() || attempts > 120) window.clearInterval(timer);
    }, 100);

    return () => {
      window.clearInterval(timer);
      document.getElementById(style.id)?.remove();
    };
  }, []);

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
        aria-label="Open photorealistic 3D ResMap"
      >
        <Rotate3D className="h-5 w-5 text-cyan-300" />3D
      </button>
      <ThreeDOverlay open={threeDOpen} onClose={() => set3D(false)} />
    </>
  );
}
