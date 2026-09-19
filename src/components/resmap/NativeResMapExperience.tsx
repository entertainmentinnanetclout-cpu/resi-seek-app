import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Box, Loader2, Rotate3D, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getLiveLocationState } from "@/lib/resmap/liveLocation";
import type { ResidenceFilters } from "@/hooks/useResidenceFilters";
import ResMapExperiencePremiumV2 from "./ResMapExperiencePremiumV2";

type Props = {
  filters: ResidenceFilters;
  updateFilter: <K extends keyof ResidenceFilters>(key: K, value: ResidenceFilters[K]) => void;
  resetFilters: () => void;
  onClose: () => void;
};
type Point = { id: string; name: string; latitude: number | string | null; longitude: number | string | null };

let scriptPromise: Promise<any> | null = null;
function loadMaps(key: string) {
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Map connection timed out")), 12_000);
    const done = () => {
      window.clearTimeout(timer);
      if (w.google?.maps?.importLibrary) resolve(w.google);
      else reject(new Error("Maps did not initialize"));
    };
    const existing = document.getElementById("resmap-google-maps-js") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.id = "resmap-google-maps-js";
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    }
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error("Google Maps is unavailable")); }, { once: true });
    if (!existing) document.head.appendChild(script);
    if (w.google?.maps?.importLibrary) done();
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
}

function safeForVector() {
  // Native WebViews on low-memory / GPU-limited devices can have their renderer
  // killed by the photorealistic Map3DElement. Do not instantiate it on Android.
  const memory = Number((navigator as any).deviceMemory || 0);
  if (memory > 0 && memory < 3) return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true, powerPreference: "low-power" });
    if (!gl) return false;
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return maxTexture >= 4096;
  } catch { return false; }
}

function NativeVector3D({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported" | "error">("loading");
  const [detail, setDetail] = useState("");
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;
    if (!safeForVector()) { setState("unsupported"); return; }
    setState("loading");
    (async () => {
      const [configResult, pointsResult] = await Promise.all([
        (supabase as any).from("resmap_map_config").select("google_maps_enabled,google_maps_browser_key,google_maps_map_id").eq("id", 1).maybeSingle(),
        (supabase as any).from("residences").select("id,name,latitude,longitude").eq("is_visible", true).limit(40),
      ]);
      const config = configResult.data;
      if (!config?.google_maps_enabled || !config.google_maps_browser_key) throw new Error("The 3D map service is not configured");
      const google = await loadMaps(config.google_maps_browser_key);
      if (disposed || !hostRef.current) return;
      const maps = await google.maps.importLibrary("maps");
      if (disposed || !hostRef.current) return;
      const rows = ((pointsResult.data || []) as Point[]).filter(row => {
        const lat = Number(row.latitude), lng = Number(row.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35.5 && lat <= -21 && lng >= 15 && lng <= 34;
      }).slice(0, 16);
      const gps = getLiveLocationState();
      const first = rows[0];
      const center = gps.status === "granted" && gps.position
        ? { lat: gps.position.latitude, lng: gps.position.longitude }
        : first ? { lat: Number(first.latitude), lng: Number(first.longitude) } : { lat: -25.754, lng: 28.188 };
      const map = new maps.Map(hostRef.current, {
        center, zoom: 16, tilt: 45, heading: 0,
        mapTypeId: "hybrid", renderingType: maps.RenderingType?.VECTOR,
        ...(config.google_maps_map_id ? { mapId: config.google_maps_map_id } : {}),
        tiltInteractionEnabled: true, headingInteractionEnabled: true,
        mapTypeControl: false, fullscreenControl: false, streetViewControl: false,
        gestureHandling: "greedy", keyboardShortcuts: false,
      });
      // Keep Android marker count low and never mount a second GPU map underneath.
      if (google.maps.Marker) rows.forEach(row => new google.maps.Marker({ map, position: { lat: Number(row.latitude), lng: Number(row.longitude) }, title: row.name }));
      if (!disposed) setState("ready");
    })().catch(error => {
      if (disposed) return;
      setDetail(error instanceof Error ? error.message : "Map unavailable");
      setState("error");
    });
    return () => { disposed = true; host.replaceChildren(); };
  }, []);
  return <div className="fixed inset-0 z-[280] overflow-hidden bg-slate-950 text-white">
    <div ref={hostRef} className="absolute inset-0" aria-label="Interactive native 3D vector map" />
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3 pt-[calc(12px+env(safe-area-inset-top))]">
      <button type="button" onClick={onBack} className="pointer-events-auto flex min-h-11 items-center gap-2 rounded-full bg-slate-950/90 px-4 text-sm font-bold shadow-lg"><ArrowLeft className="h-4 w-4" />2D map</button>
      <div className="rounded-full bg-slate-950/90 px-3 py-3 text-xs font-bold"><Rotate3D className="mr-1 inline h-4 w-4 text-cyan-300" />3D vector</div>
      <button type="button" onClick={onClose} aria-label="Close map" className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-slate-950/90 shadow-lg"><X className="h-5 w-5" /></button>
    </div>
    {state === "loading" && <div role="status" className="absolute inset-0 grid place-items-center"><div className="flex items-center gap-2 rounded-full bg-slate-950/90 px-5 py-3"><Loader2 className="h-5 w-5 animate-spin" />Preparing the map…</div></div>}
    {(state === "unsupported" || state === "error") && <div role="alert" className="absolute inset-0 grid place-items-center bg-slate-950/95 p-5"><div className="max-w-sm rounded-3xl border border-white/20 bg-slate-900 p-6 text-center"><Box className="mx-auto h-9 w-9 text-cyan-300" /><h2 className="mt-3 text-xl font-black">3D is unavailable on this device</h2><p className="mt-2 text-sm text-white/70">{state === "unsupported" ? "This device does not have enough graphics capacity for a stable 3D map." : detail} Your regular accommodation map and campus search are still available.</p><Button type="button" onClick={onBack} className="mt-5">Return to the 2D map</Button></div></div>}
  </div>;
}

/** Native 3D is isolated from the 2D map: no concurrent WebGL maps or photorealistic tiles. */
export default function NativeResMapExperience(props: Props) {
  const [threeD, setThreeD] = useState(false);
  const onClose = () => { setThreeD(false); props.onClose(); };
  if (threeD) return <NativeVector3D onBack={() => setThreeD(false)} onClose={onClose} />;
  return <>
    <ResMapExperiencePremiumV2 {...props} />
    <button type="button" onClick={() => setThreeD(true)} className="fixed bottom-[calc(82px+env(safe-area-inset-bottom))] right-3 z-[230] inline-flex min-h-12 items-center gap-2 rounded-full border border-white/80 bg-slate-950 px-4 text-sm font-black text-white shadow-2xl" aria-label="Open native 3D map"><Rotate3D className="h-5 w-5 text-cyan-300" />3D</button>
  </>;
}
