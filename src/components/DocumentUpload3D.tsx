import { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles, Text } from "@react-three/drei";
import * as THREE from "three";

type UploadState = "idle" | "uploading" | "success" | "error";

interface AnimatedCubeProps {
  state: UploadState;
  progress: number;
}

const AnimatedCube = ({ state, progress }: AnimatedCubeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [scale, setScale] = useState(1);
  const [color, setColor] = useState("#6366f1");

  useEffect(() => {
    switch (state) {
      case "idle":
        setColor("#6366f1");
        setScale(1);
        break;
      case "uploading":
        setColor("#f59e0b");
        setScale(1 + progress * 0.3);
        break;
      case "success":
        setColor("#22c55e");
        setScale(1.3);
        break;
      case "error":
        setColor("#ef4444");
        setScale(0.8);
        break;
    }
  }, [state, progress]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      const speed = state === "uploading" ? 3 : state === "success" ? 0.5 : 1;
      meshRef.current.rotation.x += delta * speed;
      meshRef.current.rotation.y += delta * speed * 0.7;
    }
  });

  return (
    <Float speed={state === "idle" ? 2 : 0} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={meshRef} scale={scale}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          metalness={0.5}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={state === "uploading" ? 0.3 : 0.1}
        />
      </mesh>
      {state === "success" && (
        <Sparkles count={50} scale={3} size={3} speed={0.5} color="#22c55e" />
      )}
      {state === "uploading" && (
        <Sparkles count={30} scale={2} size={2} speed={2} color="#f59e0b" />
      )}
    </Float>
  );
};

const ProgressText = ({ progress, state }: { progress: number; state: UploadState }) => {
  let text = "";
  switch (state) {
    case "idle":
      text = "Ready";
      break;
    case "uploading":
      text = `${Math.round(progress * 100)}%`;
      break;
    case "success":
      text = "Done!";
      break;
    case "error":
      text = "Error";
      break;
  }

  return (
    <Text
      position={[0, -1.5, 0]}
      fontSize={0.3}
      color={state === "error" ? "#ef4444" : state === "success" ? "#22c55e" : "#fff"}
      anchorX="center"
      anchorY="middle"
      font="/fonts/Inter-Bold.woff"
    >
      {text}
    </Text>
  );
};

interface DocumentUpload3DProps {
  state: UploadState;
  progress: number;
  className?: string;
}

const DocumentUpload3D = ({ state, progress, className = "" }: DocumentUpload3DProps) => {
  return (
    <div className={`w-full h-32 rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 ${className}`}>
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#6366f1" />
          <AnimatedCube state={state} progress={progress} />
          <ProgressText progress={progress} state={state} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default DocumentUpload3D;
export type { UploadState };
