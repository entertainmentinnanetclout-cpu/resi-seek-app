import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { BackSide, LinearFilter, MathUtils, SRGBColorSpace, TextureLoader } from "three";
import { ArrowRight, Info, MapPin, ShieldAlert } from "lucide-react";
import { isNativeApp } from "@/lib/accountRouting";
import { isNativeGraphicsSafeMode, reportRuntimeEvent } from "@/lib/runtimeDiagnostics";

export type ViewerHotspot = { id: string; hotspot_type: string; label: string; body?: string | null; target_scene_id?: string | null; yaw: number; pitch: number; cta_url?: string | null };
export type ViewerConnection = { id: string; from_scene_id: string; to_scene_id: string; label?: string | null; yaw: number; pitch: number };

function Sphere({ url, lowMemory }: { url: string; lowMemory: boolean }) {
  const texture = useLoader(TextureLoader, url);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    // 4K panorama mipmaps materially increase GPU memory. Linear filtering keeps
    // the immersive view while avoiding the extra mipmap allocation.
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return () => { texture.dispose(); };
  }, [texture]);
  return <mesh scale={[-1, 1, 1]}><sphereGeometry args={lowMemory ? [8, 40, 24] : [8, 64, 40]} /><meshBasicMaterial map={texture} side={BackSide} /></mesh>;
}

function WebGLGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener("webglcontextlost", lost, false);
    return () => canvas.removeEventListener("webglcontextlost", lost, false);
  }, [gl, onLost]);
  return null;
}

function DeviceOrientationCamera({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const sample = useRef({ alpha: 0, beta: 0, gamma: 0, ready: false });

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: DeviceOrientationEvent) => {
      if (event.alpha == null || event.beta == null || event.gamma == null) return;
      sample.current = { alpha: event.alpha, beta: event.beta, gamma: event.gamma, ready: true };
    };
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [enabled]);

  useFrame(() => {
    if (!enabled || !sample.current.ready) return;
    const { alpha, beta, gamma } = sample.current;
    const screenAngle = Number(window.screen?.orientation?.angle ?? (window as any).orientation ?? 0);
    camera.rotation.order = "YXZ";
    camera.rotation.x = MathUtils.degToRad(beta - 90);
    camera.rotation.y = MathUtils.degToRad(alpha);
    camera.rotation.z = MathUtils.degToRad(-gamma - screenAngle);
  });
  return null;
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
  motionEnabled = false,
  onHotspotAction,
}: {
  panoramaUrl: string;
  hotspots?: ViewerHotspot[];
  connections?: ViewerConnection[];
  onNavigate?: (sceneId: string) => void;
  motionEnabled?: boolean;
  onHotspotAction?: (item: { kind: "connection" | "hotspot"; id: string; label: string; target_scene_id?: string | null; cta_url?: string | null }) => void;
}) {
  const all = useMemo(() => [
    ...connections.map((c) => ({ id: `c-${c.id}`, rawId: c.id, kind: "connection" as const, label: c.label || "Continue", body: null, target_scene_id: c.to_scene_id, cta_url: null, yaw: Number(c.yaw || 0), pitch: Number(c.pitch || 0) })),
    ...hotspots.map((h) => ({ id: `h-${h.id}`, rawId: h.id, kind: "hotspot" as const, label: h.label, body: h.body || null, target_scene_id: h.target_scene_id || null, cta_url: h.cta_url || null, yaw: Number(h.yaw || 0), pitch: Number(h.pitch || 0), hotspot_type: h.hotspot_type })),
  ], [connections, hotspots]);
  const native = useMemo(() => isNativeApp(), []);
  const lowMemory = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const memory = Number((navigator as any).deviceMemory || 0);
    return native || (memory > 0 && memory <= 4) || /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, [native]);
  const [paused, setPaused] = useState(() => document.visibilityState === "hidden");
  const [graphicsFailed, setGraphicsFailed] = useState(() => isNativeGraphicsSafeMode());

  useEffect(() => {
    const visibility = () => setPaused(document.visibilityState === "hidden");
    const memoryPressure = () => {
      if (!native) return;
      setGraphicsFailed(true);
      void reportRuntimeEvent("memory_pressure", "360 viewer released under Android memory pressure", { surface: "virtual_360" });
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("rk-native-memory-pressure" as any, memoryPressure as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("rk-native-memory-pressure" as any, memoryPressure as EventListener);
    };
  }, [native]);

  const onContextLost = useCallback(() => {
    setGraphicsFailed(true);
    void reportRuntimeEvent("webgl_context_lost", "360 viewer WebGL context was lost", { surface: "virtual_360" });
  }, []);

  if (graphicsFailed) {
    return <div className="grid h-full min-h-[420px] w-full place-items-center bg-slate-950 p-6 text-white"><div className="max-w-md text-center"><ShieldAlert className="mx-auto h-9 w-9 text-amber-300" /><h3 className="mt-3 text-xl font-black">360 view paused for stability</h3><p className="mt-2 text-sm text-white/70">This device recently reported graphics or memory pressure. ResKonnect has disabled the heavy interactive renderer so the rest of the app stays usable.</p></div></div>;
  }

  if (paused) {
    return <div className="grid h-full min-h-[420px] w-full place-items-center bg-black text-sm text-white/60">360 view paused while ResKonnect is in the background.</div>;
  }

  return <div className="relative h-full min-h-[420px] w-full touch-none overflow-hidden bg-black">
    <Canvas camera={{ position: [0, 0, .1], fov: 74 }} dpr={lowMemory ? 1 : [1, 1.6]} frameloop={motionEnabled ? "always" : "demand"} gl={{ antialias: !lowMemory, powerPreference: lowMemory ? "low-power" : "high-performance" }}>
      <Suspense fallback={<Html center><div className="rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white">Loading 4K scene…</div></Html>}>
        <WebGLGuard onLost={onContextLost} />
        <Sphere url={panoramaUrl} lowMemory={lowMemory} />
        <DeviceOrientationCamera enabled={motionEnabled} />
        {all.map((item) => <Html key={item.id} position={point(item.yaw, item.pitch)} center distanceFactor={8} transform={false}>
          <button
            type="button"
            className="group min-w-max rounded-full border border-white/30 bg-[#071326]/90 px-3 py-2 text-xs font-black text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-[#0b1c38]"
            onClick={(event) => {
              event.stopPropagation();
              onHotspotAction?.({ kind: item.kind, id: item.rawId, label: item.label, target_scene_id: item.target_scene_id, cta_url: item.cta_url });
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
      <OrbitControls enabled={!motionEnabled} enablePan={false} enableDamping dampingFactor={.08} rotateSpeed={-.28} minDistance={.1} maxDistance={.1} />
    </Canvas>
    <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">{motionEnabled ? "Move your phone to look around" : "Drag to look around · pinch/scroll to explore"}</div>
  </div>;
}
