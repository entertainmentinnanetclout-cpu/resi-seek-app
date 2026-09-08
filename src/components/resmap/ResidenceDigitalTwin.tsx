import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

function UploadedModel({ url, scale = 1 }: { url: string; scale?: number }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} scale={scale} />;
}

export default function ResidenceDigitalTwin({ residence, twin }: { residence: any; twin?: any; roomCount?: number }) {
  const verifiedModelUrl = twin?.is_verified === true && typeof twin?.model_url === "string" && twin.model_url.trim() ? twin.model_url.trim() : null;
  const scale = Number(twin?.scale || 1);
  const image = residence?.cover_image_url || residence?.image_url || (Array.isArray(residence?.images) ? residence.images.find(Boolean) : null);

  if (!verifiedModelUrl) {
    return <div className="relative min-h-[46vh] overflow-hidden rounded-[28px] border bg-slate-100 dark:bg-slate-950">
      {image ? <img src={image} alt={`${residence?.name || "Residence"} exterior reference`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900"><Building2 className="h-20 w-20 text-slate-400" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
      <div className="absolute left-4 top-4 rounded-full border border-white/25 bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
        Exterior reference · not a digital twin
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
        <div className="max-w-2xl rounded-[22px] border border-white/20 bg-black/45 p-4 backdrop-blur-md sm:p-5">
          <div className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="h-4 w-4 text-emerald-300" />Accuracy gate active</div>
          <h3 className="mt-2 text-xl font-black">Verified 3D twin pending</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/85">ResKonnect no longer generates a generic building shape and calls it a digital twin. A 3D twin will only appear here after a real model of this specific residence has been uploaded and verified against the actual building.</p>
          {residence?.google_maps_url && <Button variant="secondary" size="sm" className="mt-4" asChild><a href={residence.google_maps_url} target="_blank" rel="noreferrer">Check the real building on Google Maps<ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>}
        </div>
      </div>
    </div>;
  }

  return <div className="relative h-[46vh] min-h-[340px] w-full overflow-hidden rounded-[28px] border bg-gradient-to-b from-sky-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border border-emerald-300/60 bg-emerald-950/75 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
      Verified digital twin
    </div>
    <Canvas shadows camera={{ position: [9, 7, 11], fov: 42 }}>
      <ambientLight intensity={0.85} />
      <directionalLight castShadow intensity={1.6} position={[7, 10, 5]} />
      <directionalLight intensity={0.45} position={[-5, 3, -4]} />
      <gridHelper args={[30, 30, "#7c8ea8", "#d7e0ec"]} position={[0, -0.9, 0]} />
      <Suspense fallback={<Html center><div className="rounded-full bg-background/90 px-4 py-2 text-sm shadow">Loading verified 3D residence…</div></Html>}>
        <UploadedModel url={verifiedModelUrl} scale={scale} />
      </Suspense>
      <OrbitControls enablePan={false} minDistance={7} maxDistance={22} maxPolarAngle={Math.PI / 2.04} />
    </Canvas>
  </div>;
}
