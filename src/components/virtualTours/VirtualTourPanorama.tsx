import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { BackSide, TextureLoader } from "three";
import { ArrowRight, Info, MapPin } from "lucide-react";

export type ViewerHotspot = { id: string; hotspot_type: string; label: string; body?: string | null; target_scene_id?: string | null; yaw: number; pitch: number; cta_url?: string | null };
export type ViewerConnection = { id: string; from_scene_id: string; to_scene_id: string; label?: string | null; yaw: number; pitch: number };

function Sphere({ url }: { url: string }) {
  const texture = useLoader(TextureLoader, url);
  return <mesh scale={[-1, 1, 1]}><sphereGeometry args={[8, 96, 64]} /><meshBasicMaterial map={texture} side={BackSide} /></mesh>;
}
function point(yaw: number, pitch: number, r = 7.1) {
  const yr = yaw * Math.PI / 180; const pr = pitch * Math.PI / 180;
  return [r * Math.sin(yr) * Math.cos(pr), r * Math.sin(pr), -r * Math.cos(yr) * Math.cos(pr)] as [number, number, number];
}

export default function VirtualTourPanorama({
  panoramaUrl,
  hotspots = [],
  connections = [],
  onNavigate,
}: {
  panoramaUrl: string;
  hotspots?: ViewerHotspot[];
  connections?: ViewerConnection[];
  onNavigate?: (sceneId: string) => void;
}) {
  const all = useMemo(() => [
    ...connections.map((c) => ({ id: `c-${c.id}`, kind: "connection" as const, label: c.label || "Continue", body: null, target_scene_id: c.to_scene_id, cta_url: null, yaw: Number(c.yaw || 0), pitch: Number(c.pitch || 0) })),
    ...hotspots.map((h) => ({ id: `h-${h.id}`, kind: "hotspot" as const, label: h.label, body: h.body || null, target_scene_id: h.target_scene_id || null, cta_url: h.cta_url || null, yaw: Number(h.yaw || 0), pitch: Number(h.pitch || 0), hotspot_type: h.hotspot_type })),
  ], [connections, hotspots]);

  return <div className="relative h-full min-h-[420px] w-full overflow-hidden bg-black">
    <Canvas camera={{ position: [0, 0, .1], fov: 74 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <Suspense fallback={<Html center><div className="rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white">Loading 4K scene…</div></Html>}>
        <Sphere url={panoramaUrl} />
        {all.map((item) => <Html key={item.id} position={point(item.yaw, item.pitch)} center distanceFactor={8} transform={false}>
          <button
            type="button"
            className="group min-w-max rounded-full border border-white/30 bg-[#071326]/90 px-3 py-2 text-xs font-black text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-[#0b1c38]"
            onClick={(event) => {
              event.stopPropagation();
              if (item.target_scene_id && onNavigate) onNavigate(item.target_scene_id);
              else if (item.cta_url) window.open(item.cta_url, "_blank", "noopener,noreferrer");
            }}
            title={item.body || item.label}
          >
            {item.kind === "connection" ? <ArrowRight className="mr-1.5 inline h-3.5 w-3.5 text-[#F5B32F]" /> : item.hotspot_type === "info" ? <Info className="mr-1.5 inline h-3.5 w-3.5 text-cyan-300" /> : <MapPin className="mr-1.5 inline h-3.5 w-3.5 text-[#F5B32F]" />}
            {item.label}
          </button>
        </Html>)}
      </Suspense>
      <OrbitControls enablePan={false} enableDamping dampingFactor={.08} rotateSpeed={-.28} minDistance={.1} maxDistance={.1} />
    </Canvas>
    <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">Drag to look around · pinch/scroll to explore</div>
  </div>;
}
