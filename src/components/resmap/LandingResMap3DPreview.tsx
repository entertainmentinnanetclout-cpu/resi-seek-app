import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Loader2, MapPinned, Rotate3D, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

type PreviewStatus = "loading" | "ready" | "failed";

const PRETORIA = { lat: -25.7479, lng: 28.2293, altitude: 0 };
let previewLoader: Promise<any> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser"));
  const w = window as any;
  if (w.google?.maps?.importLibrary) return Promise.resolve(w.google);
  if (previewLoader) return previewLoader;

  previewLoader = new Promise((resolve, reject) => {
    const id = "resmap-google-maps-js";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    const finish = () => w.google?.maps?.importLibrary ? resolve(w.google) : reject(new Error("Google Maps did not initialize"));
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
    previewLoader = null;
    throw error;
  });
  return previewLoader;
}

function validPoint(row: PointRow) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35.5 && lat <= -21 && lng >= 15 && lng <= 34;
}

export default function LandingResMap3DPreview() {
  const navigate = useNavigate();
  const mapNode = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<any[]>([]);
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    if (!mapNode.current) return;
    let disposed = false;
    setStatus("loading");

    (async () => {
      const [configResult, residenceResult] = await Promise.all([
        (supabase as any).from("resmap_map_config")
          .select("google_maps_enabled,google_maps_browser_key,google_maps_map_id")
          .eq("id", 1)
          .maybeSingle(),
        (supabase as any).from("residences")
          .select("id,name,latitude,longitude")
          .eq("is_visible", true)
          .limit(100),
      ]);
      if (disposed) return;

      const config = configResult.data as MapConfig | null;
      if (!config?.google_maps_enabled || !config.google_maps_browser_key) throw new Error("Google 3D is not configured");

      const points = ((residenceResult.data || []) as PointRow[]).filter(validPoint);
      const preferred = points.find((row) => Number(row.latitude) > -26.2 && Number(row.latitude) < -25.2) || points[0];
      const center = preferred
        ? { lat: Number(preferred.latitude), lng: Number(preferred.longitude), altitude: 0 }
        : PRETORIA;

      const google = await loadGoogleMaps(config.google_maps_browser_key);
      const maps3d = await google.maps.importLibrary("maps3d");
      if (disposed || !mapNode.current) return;

      const Map3DElement = maps3d.Map3DElement;
      const Marker3DInteractiveElement = maps3d.Marker3DInteractiveElement;
      if (!Map3DElement) throw new Error("3D maps are unsupported here");

      const map3d = new Map3DElement({
        center,
        tilt: 65,
        heading: 18,
        range: 12500,
        mode: maps3d.MapMode?.SATELLITE ?? "SATELLITE",
        gestureHandling: maps3d.GestureHandling?.COOPERATIVE ?? "COOPERATIVE",
        defaultUIHidden: true,
        ...(config.google_maps_map_id ? { mapId: config.google_maps_map_id } : {}),
      });
      map3d.style.width = "100%";
      map3d.style.height = "100%";
      mapNode.current.replaceChildren(map3d);

      markerRefs.current = [];
      if (Marker3DInteractiveElement) {
        points.slice(0, 70).forEach((row) => {
          const marker = new Marker3DInteractiveElement({
            position: { lat: Number(row.latitude), lng: Number(row.longitude), altitude: 0 },
            label: row.name.slice(0, 34),
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
      console.warn("Landing ResMap 3D preview unavailable", error);
      setStatus("failed");
    });

    return () => {
      disposed = true;
      markerRefs.current.forEach((marker) => {
        try { marker.remove(); } catch { /* no-op */ }
      });
      markerRefs.current = [];
      if (mapNode.current) mapNode.current.replaceChildren();
    };
  }, []);

  const openFull = () => navigate("/findmyres?view=map&mode=3d");

  return (
    <section className="relative overflow-hidden border-y border-slate-200/70 bg-slate-950 py-10 text-white md:py-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-500 text-white"><Rotate3D className="mr-1 h-3.5 w-3.5" />RESMAP 3D</Badge>
              <Badge variant="outline" className="border-white/25 text-white"><Sparkles className="mr-1 h-3.5 w-3.5" />Powered by Dimpho intelligence</Badge>
            </div>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">See student accommodation in a new dimension.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">Explore the real-world area around mapped residences in photorealistic 3D where imagery is available. This embedded view stays part of the page so you can keep scrolling; open the full ResMap for live location, filters, routing, immersive Street View and complete camera control.</p>
          </div>
          <Button onClick={openFull} className="h-12 rounded-full bg-white px-6 font-black text-slate-950 hover:bg-slate-100">Open full ResMap <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
        </div>

        <div className="relative h-[410px] overflow-hidden rounded-[30px] border border-white/15 bg-slate-900 shadow-2xl md:h-[520px]">
          <div ref={mapNode} className="absolute inset-0" aria-label="Interactive ResMap photorealistic 3D preview" />
          <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/15 bg-slate-950/75 px-3 py-2 text-[11px] font-bold shadow-xl backdrop-blur">Drag to explore · page scrolling remains enabled</div>

          {status === "loading" && (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-slate-950/35">
              <div className="flex items-center gap-2 rounded-full bg-slate-950/85 px-4 py-2 text-sm font-bold shadow-xl backdrop-blur"><Loader2 className="h-4 w-4 animate-spin" />Loading ResMap 3D…</div>
            </div>
          )}

          {status === "failed" && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[radial-gradient(circle_at_top,#17365f,#071326_58%)] p-6 text-center">
              <div className="max-w-lg">
                <MapPinned className="mx-auto h-10 w-10 text-cyan-300" />
                <h3 className="mt-3 text-2xl font-black">ResMap is still live</h3>
                <p className="mt-2 text-sm text-slate-300">Photorealistic 3D depends on compatible Google Maps 3D coverage and browser support. Open the full ResMap to browse mapped accommodation and navigation.</p>
                <Button onClick={openFull} className="mt-5 bg-white text-slate-950 hover:bg-slate-100">Open ResMap</Button>
              </div>
            </div>
          )}

          {selectedName && status === "ready" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
              <div className="rounded-full border border-white/20 bg-slate-950/80 px-4 py-2 text-xs font-bold shadow-xl backdrop-blur"><MapPinned className="mr-1.5 inline h-4 w-4 text-cyan-300" />{selectedName}</div>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">Photorealistic imagery reflects Google Maps 3D coverage and capture availability; it is displayed without ResKonnect colour filters or artificial recolouring.</p>
      </div>
    </section>
  );
}
