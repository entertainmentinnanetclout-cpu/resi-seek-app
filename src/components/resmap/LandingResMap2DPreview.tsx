import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, MapPinned, Minus, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const TILE_SIZE = 256;
const MIN_ZOOM = 5;
const MAX_ZOOM = 18;
const PRETORIA = { lat: -25.7479, lng: 28.2293 };
const OSM_PRIMARY = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_FALLBACK = "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";

type PointRow = {
  id: string;
  name: string;
  latitude: number | string | null;
  longitude: number | string | null;
};

type Size = { width: number; height: number };
type Center = { lat: number; lng: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const clampedLat = clamp(lat, -85.05112878, 85.05112878);
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): Center {
  const scale = TILE_SIZE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat: clamp(lat, -85.05112878, 85.05112878), lng };
}

function tileUrl(template: string, z: number, x: number, y: number) {
  return template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}

function validPoint(row: PointRow) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35.5 && lat <= -21 && lng >= 15 && lng <= 34;
}

export default function LandingResMap2DPreview() {
  const navigate = useNavigate();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [size, setSize] = useState<Size>({ width: 900, height: 500 });
  const [center, setCenter] = useState<Center>(PRETORIA);
  const [zoom, setZoom] = useState(13);
  const [points, setPoints] = useState<PointRow[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setSize({ width: Math.max(320, node.clientWidth), height: Math.max(280, node.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("residences")
        .select("id,name,latitude,longitude")
        .eq("is_visible", true)
        .limit(120);
      if (!active) return;
      const mapped = ((data || []) as PointRow[]).filter(validPoint);
      setPoints(mapped);
      const preferred = mapped.find((row) => Number(row.latitude) > -26.2 && Number(row.latitude) < -25.2);
      if (preferred) setCenter({ lat: Number(preferred.latitude), lng: Number(preferred.longitude) });
    })();
    return () => { active = false; };
  }, []);

  const worldCenter = useMemo(() => project(center.lat, center.lng, zoom), [center, zoom]);
  const topLeft = useMemo(() => ({ x: worldCenter.x - size.width / 2, y: worldCenter.y - size.height / 2 }), [worldCenter, size]);

  const tiles = useMemo(() => {
    const maxTile = 2 ** zoom;
    const minX = Math.floor(topLeft.x / TILE_SIZE) - 1;
    const maxX = Math.floor((topLeft.x + size.width) / TILE_SIZE) + 1;
    const minY = Math.floor(topLeft.y / TILE_SIZE) - 1;
    const maxY = Math.floor((topLeft.y + size.height) / TILE_SIZE) + 1;
    const items: Array<{ key: string; x: number; y: number; wrappedX: number; left: number; top: number }> = [];
    for (let x = minX; x <= maxX; x += 1) {
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= maxTile) continue;
        items.push({ key: `${zoom}:${x}:${y}`, x, y, wrappedX, left: x * TILE_SIZE - topLeft.x, top: y * TILE_SIZE - topLeft.y });
      }
    }
    return items;
  }, [topLeft, size, zoom]);

  const markers = useMemo(() => points.slice(0, 90).map((row) => {
    const world = project(Number(row.latitude), Number(row.longitude), zoom);
    return { row, left: world.x - topLeft.x, top: world.y - topLeft.y };
  }).filter((item) => item.left > -40 && item.left < size.width + 40 && item.top > -50 && item.top < size.height + 50), [points, zoom, topLeft, size]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const world = project(center.lat, center.lng, zoom);
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, worldX: world.x, worldY: world.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setCenter(unproject(drag.worldX - dx, drag.worldY - dy, zoom));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const openFull = () => navigate("/findmyres?view=map");

  return (
    <section className="relative overflow-hidden border-y border-slate-200/70 bg-slate-950 py-10 text-white md:py-14">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-cyan-500 text-white"><MapPinned className="mr-1 h-3.5 w-3.5" />LIVE RESMAP</Badge>
              <Badge variant="outline" className="border-white/25 text-white"><Sparkles className="mr-1 h-3.5 w-3.5" />Powered by Dimpho intelligence</Badge>
            </div>
            <h2 className="text-3xl font-black tracking-tight md:text-5xl">Preview accommodation on the live 2D ResMap.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">This lightweight preview uses the same mapped residence coordinates without loading the heavier 3D engine on the landing page. Open the full ResMap for filters, live location, routing, Street View and the dedicated 3D mode.</p>
          </div>
          <Button onClick={openFull} className="h-12 rounded-full bg-white px-6 font-black text-slate-950 hover:bg-slate-100">Open full ResMap <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
        </div>

        <div ref={viewportRef} className="relative h-[410px] overflow-hidden rounded-[30px] border border-white/15 bg-slate-200 shadow-2xl md:h-[520px]" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{ touchAction: "pan-y" }} aria-label="Interactive ResMap 2D preview">
          <div className="absolute inset-0 bg-slate-200">
            {tiles.map((tile) => (
              <img
                key={tile.key}
                src={tileUrl(OSM_PRIMARY, zoom, tile.wrappedX, tile.y)}
                alt=""
                draggable={false}
                className="pointer-events-none absolute h-64 w-64 select-none"
                style={{ left: tile.left, top: tile.top }}
                onError={(event) => {
                  const image = event.currentTarget;
                  const fallback = tileUrl(OSM_FALLBACK, zoom, tile.wrappedX, tile.y);
                  if (image.src !== fallback) image.src = fallback;
                  else image.style.visibility = "hidden";
                }}
              />
            ))}
          </div>

          {markers.map(({ row, left, top }) => (
            <button key={row.id} type="button" onClick={() => setSelectedName(row.name)} className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-full border-2 border-white bg-cyan-600 px-2.5 py-1 text-[10px] font-black text-white shadow-xl hover:bg-cyan-500" style={{ left, top }} aria-label={`View ${row.name}`}>⌂</button>
          ))}

          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full border border-white/70 bg-white/92 px-3 py-2 text-[11px] font-black text-slate-900 shadow-xl backdrop-blur">Live residence coordinates · desktop drag · open full map for complete controls</div>

          <div className="absolute right-3 top-3 z-20 grid gap-2">
            <button type="button" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 1))} className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white text-slate-900 shadow-xl" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 1))} className="grid h-10 w-10 place-items-center rounded-full border border-white/70 bg-white text-slate-900 shadow-xl" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
          </div>

          {selectedName && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <div className="rounded-full border border-white/70 bg-white/95 px-4 py-2 text-xs font-black text-slate-900 shadow-xl backdrop-blur"><MapPinned className="mr-1.5 inline h-4 w-4 text-cyan-600" />{selectedName}</div>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-slate-400">The landing page intentionally stays in 2D for reliability and speed. Photorealistic/vector 3D is loaded only after a user opens the full ResMap.</p>
      </div>
    </section>
  );
}
