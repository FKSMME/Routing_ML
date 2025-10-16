import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box } from "@react-three/drei";
import * as THREE from "three";
import { useBackgroundSettings } from "@store/backgroundSettings";

function RotatingBox() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { autoRotate, rotateSpeed, modelScale } = useBackgroundSettings();

  useFrame((state) => {
    if (!meshRef.current) return;

    if (autoRotate) {
      meshRef.current.rotation.x += rotateSpeed * 0.01;
      meshRef.current.rotation.y += rotateSpeed * 0.015;
    }

    // Floating effect
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.3;
  });

  return (
    <Box ref={meshRef} args={[modelScale, modelScale, modelScale]}>
      <meshStandardMaterial
        color="#0ea5e9"
        metalness={0.7}
        roughness={0.2}
        emissive="#0ea5e9"
        emissiveIntensity={0.3}
      />
    </Box>
  );
}

export function FullScreen3DBackground() {
  const { enabled, opacity } = useBackgroundSettings();

  if (!enabled) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        opacity,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#a855f7" />
        <RotatingBox />
      </Canvas>
    </div>
  );
}
