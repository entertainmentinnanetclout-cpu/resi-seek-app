import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { BackSide, TextureLoader } from "three";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function PanoramaSphere({ url }: { url: string }) {
  const texture = useLoader(TextureLoader, url);
  return <mesh scale={[-1, 1, 1]}>
    <sphereGeometry args={[8, 64, 40]} />
    <meshBasicMaterial map={texture} side={BackSide} />
  </mesh>;
}

function isImageUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|avif)$/.test(clean);
}

export default function Residence360Viewer({ tourUrl, title = "360 residence tour" }: { tourUrl?: string | null; title?: string }) {
  const url = String(tourUrl || "").trim();
  const image = useMemo(() => isImageUrl(url), [url]);
  if (!url) return <div className="grid min-h-[320px] place-items-center rounded-[28px] border border-dashed bg-muted/30 p-8 text-center">
    <div><ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" /><p className="mt-3 font-bold">360 tour not uploaded yet</p><p className="mt-1 max-w-md text-sm text-muted-foreground">The residence can add a verified 360 panorama or hosted virtual tour without changing the ResMap experience.</p></div>
  </div>;

  if (image) return <div className="relative h-[52vh] min-h-[340px] overflow-hidden rounded-[28px] border bg-black">
    <div className="absolute left-4 top-4 z-10 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">Drag to look around · {title}</div>
    <Canvas camera={{ position: [0, 0, 0.1], fov: 74 }}>
      <Suspense fallback={<Html center><div className="rounded-full bg-black/70 px-4 py-2 text-sm text-white">Loading panorama…</div></Html>}>
        <PanoramaSphere url={url} />
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={-0.28} />
    </Canvas>
  </div>;

  return <div className="overflow-hidden rounded-[28px] border bg-background">
    <div className="flex items-center justify-between gap-3 border-b p-3"><div><p className="font-bold">{title}</p><p className="text-xs text-muted-foreground">Hosted virtual-tour experience</p></div><Button asChild size="sm" variant="outline"><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open tour</a></Button></div>
    <iframe title={title} src={url} className="h-[52vh] min-h-[360px] w-full bg-muted" allow="fullscreen; accelerometer; gyroscope" loading="lazy" />
  </div>;
}
