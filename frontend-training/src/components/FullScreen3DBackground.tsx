import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useBackgroundSettings } from "@store/backgroundSettings";

const MODEL_URL = import.meta.env.VITE_BACKGROUND_MODEL_URL ?? "/models/background.glb";

useGLTF.preload(MODEL_URL);

function RotatingBox() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { autoRotate, rotateSpeed, modelScale } = useBackgroundSettings();

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (autoRotate) {
      const speed = Math.max(0.01, rotateSpeed * 0.1);
      meshRef.current.rotation.x += speed * delta * 60 * 0.5;
      meshRef.current.rotation.y += speed * delta * 60 * 0.75;
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

function BackgroundModel() {
  const { autoRotate, rotateSpeed, modelScale } = useBackgroundSettings();
  const groupRef = useRef<THREE.Group>(null);
  const gltf = useGLTF(MODEL_URL, true);

  const scene = useMemo(() => {
    // Type guard: handle both single GLTF and array cases
    const gltfData = Array.isArray(gltf) ? gltf[0] : gltf;
    if (!gltfData?.scene) return new THREE.Group();

    const cloned = gltfData.scene.clone(true);
    const applyToneMapping = (material: THREE.Material) => {
      if ("toneMapped" in material) {
        (material as THREE.MeshStandardMaterial).toneMapped = true;
      }
    };
    cloned.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.material) return;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material && applyToneMapping(material));
      } else {
        applyToneMapping(mesh.material);
      }
    });
    return cloned;
  }, [gltf]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    if (autoRotate) {
      const speed = rotateSpeed * 0.6;
      groupRef.current.rotation.y += speed * delta;
      groupRef.current.rotation.x += speed * 0.3 * delta;
    }

    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.3;
  });

  return <primitive ref={groupRef} object={scene} scale={[modelScale, modelScale, modelScale]} />;
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
        <Suspense fallback={<RotatingBox />}>
          <BackgroundModel />
        </Suspense>
      </Canvas>
    </div>
  );
}
