import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { BackSide, LinearFilter, MathUtils, SRGBColorSpace, TextureLoader } from "three";
import { isNativeApp } from "@/lib/accountRouting";
import { graphicsBudget } from "@/lib/devicePerformance";
import { ArrowRight, Info, MapPin } from "lucide-react";

export type ViewerHotspot = { id: string; hotspot_type: string; label: string; body?: string | null; target_scene_id?: string | null; yaw: number; pitch: number; cta_url?: string | null };
export type ViewerConnection = { id: string; from_scene_id: string; to_scene_id: string; label?: string | null; yaw: number; pitch: number };

class GraphicsBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[360 Viewer] graphics subtree failed safely", error.message, info.componentStack);
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Sphere({ url, constrained, segments }: { url: string; constrained: boolean; segments: [number, number] }) {
  const texture = useLoader(TextureLoader, url);
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = !constrained;
    if (constrained) texture.minFilter = LinearFilter;
    texture.anisotropy = constrained ? 1 : texture.anisotropy;
    texture.needsUpdate = true;
    return () => {
      try {
        texture.dispose();
        (useLoader as any).clear?.(TextureLoader, url);
      } catch {}
    };
  }, [constrained, texture, url]);
  return <mesh scale={[-1, 1, 1]}><sphereGeometry args={[8, segments[0], segments[1]]} /><meshBasicMaterial map={texture} side={BackSide} /></mesh>;
}

function RendererGuard({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      onLost();
    };
    canvas.addEventListener("webglcontextlost", handleLost, false);
    return () => canvas.removeEventListener("webglcontextlost", handleLost, false);
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

function StaticPanoramaPreview({ panoramaUrl, reason }: { panoramaUrl: string; reason: string }) {
  return <div className="relative grid h-full min-h-[420px] w-full place-items-center overflow-hidden bg-black p-4">
    <img src={panoramaUrl} alt="360 residence scene preview" className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" />
    <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/20 bg-black/80 p-3 text-center text-xs font-semibold text-white">
      {reason} The scene preview remains available without risking an app or browser exit.
    </div>
  </div>;
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
  const [graphicsLost, setGraphicsLost] = useState(false);
  const handleGraphicsLost = useCallback(() => setGraphicsLost(true), []);
  const webglAvailable = useMemo(() => {
    if (typeof document === "undefined") return false;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false }) || canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false });
      const ok = Boolean(gl);
      try { (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext(); } catch {}
      return ok;
    } catch { return false; }
  }, []);
  const safeGraphics = useMemo(() => {
    try { return native && localStorage.getItem("rk_native_safe_graphics_v1") === "1"; } catch { return false; }
  }, [native]);
  const budget = useMemo(() => graphicsBudget(), []);
  const lowMemory = native || budget.tier === "constrained";

  if (safeGraphics || !webglAvailable || graphicsLost) {
    const reason = safeGraphics
      ? "Immersive 360 is paused on this device after repeated graphics renderer recovery."
      : graphicsLost
        ? "The device graphics context was interrupted, so immersive 360 was safely paused."
        : "Immersive 360 is not available with the current device graphics configuration.";
    return <StaticPanoramaPreview panoramaUrl={panoramaUrl} reason={reason} />;
  }

  const localFallback = <StaticPanoramaPreview panoramaUrl={panoramaUrl} reason="Immersive 360 hit a graphics error and was safely downgraded." />;

  return <div className="relative h-full min-h-[420px] w-full touch-none overflow-hidden bg-black">
    <GraphicsBoundary fallback={localFallback}>
    <Canvas
      camera={{ position: [0, 0, .1], fov: 74 }}
      dpr={budget.dpr}
      gl={{ antialias: budget.antialias, powerPreference: lowMemory ? "low-power" : "high-performance", preserveDrawingBuffer: false }}
    >
      <RendererGuard onLost={handleGraphicsLost} />
      <Suspense fallback={<Html center><div className="rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white">Loading scene…</div></Html>}>
        <Sphere url={panoramaUrl} constrained={lowMemory} segments={budget.sphereSegments} />
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
    </GraphicsBoundary>
    <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">{motionEnabled ? "Move your phone to look around" : "Drag to look around · pinch/scroll to explore"}</div>
  </div>;
}
