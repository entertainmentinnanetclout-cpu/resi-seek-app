import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";

function UploadedModel({ url, scale = 1 }: { url: string; scale?: number }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} scale={scale} />;
}

function ProceduralTwin({ residence, roomCount }: { residence: any; roomCount: number }) {
  const floors = Math.max(1, Math.min(8, Number(residence?.digitalTwinFloors || Math.ceil(Math.max(Number(residence?.capacity || roomCount || 1), 1) / 24))));
  const width = 6.5;
  const depth = 4.8;
  const levels = useMemo(() => Array.from({ length: floors }, (_, index) => index), [floors]);
  return <group position={[0, -floors * 0.48, 0]}>
    {levels.map((floor) => <group key={floor} position={[0, floor * 1.02, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, 0.9, depth]} />
        <meshStandardMaterial color={floor % 2 === 0 ? "#0b5fff" : "#0a4bc4"} roughness={0.55} metalness={0.08} />
      </mesh>
      {Array.from({ length: 4 }, (_, i) => <mesh key={i} position={[-2.1 + i * 1.4, 0.08, depth / 2 + 0.006]}>
        <planeGeometry args={[0.78, 0.38]} />
        <meshStandardMaterial color="#bff4ff" emissive="#3cc8ff" emissiveIntensity={0.25} />
      </mesh>)}
      <mesh position={[0, 0.52, 0]} receiveShadow>
        <boxGeometry args={[width + 0.16, 0.11, depth + 0.16]} />
        <meshStandardMaterial color="#edf4ff" roughness={0.8} />
      </mesh>
    </group>)}
    <mesh position={[0, floors * 1.02 - 0.05, 0]} castShadow>
      <boxGeometry args={[width + 0.4, 0.18, depth + 0.4]} />
      <meshStandardMaterial color="#071a38" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.15, depth / 2 + 0.08]}>
      <boxGeometry args={[1.15, 1.45, 0.15]} />
      <meshStandardMaterial color="#f5b942" roughness={0.5} />
    </mesh>
  </group>;
}

export default function ResidenceDigitalTwin({ residence, twin, roomCount = 0 }: { residence: any; twin?: any; roomCount?: number }) {
  const modelUrl = twin?.model_url || undefined;
  const scale = Number(twin?.scale || 1);
  return <div className="relative h-[46vh] min-h-[340px] w-full overflow-hidden rounded-[28px] border bg-gradient-to-b from-sky-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-bold backdrop-blur">
      {modelUrl ? "Verified 3D model" : "Generated spatial twin · conceptual massing"}
    </div>
    <Canvas shadows camera={{ position: [9, 7, 11], fov: 42 }}>
      <ambientLight intensity={0.85} />
      <directionalLight castShadow intensity={1.6} position={[7, 10, 5]} />
      <directionalLight intensity={0.45} position={[-5, 3, -4]} />
      <gridHelper args={[30, 30, "#7c8ea8", "#d7e0ec"]} position={[0, -0.9, 0]} />
      <Suspense fallback={<Html center><div className="rounded-full bg-background/90 px-4 py-2 text-sm shadow">Loading 3D residence…</div></Html>}>
        {modelUrl ? <UploadedModel url={modelUrl} scale={scale} /> : <ProceduralTwin residence={residence} roomCount={roomCount} />}
      </Suspense>
      <OrbitControls enablePan={false} minDistance={7} maxDistance={22} maxPolarAngle={Math.PI / 2.04} autoRotate autoRotateSpeed={0.35} />
    </Canvas>
  </div>;
}
