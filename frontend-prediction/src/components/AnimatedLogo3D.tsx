import { Html, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const MODEL_URL = "/models/background.glb";
const SPINNER_STYLE_ID = "animated-logo-spinner-style";

function ensureSpinnerKeyframes() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SPINNER_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = SPINNER_STYLE_ID;
  style.textContent = `
    @keyframes animated-logo-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

function LogoModel() {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(MODEL_URL);

  const processed = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.8 / maxDim;

    clone.position.set(-center.x, -center.y, -center.z);
    clone.scale.setScalar(scale);
    clone.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.elapsedTime * 0.6;
    groupRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.4) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <primitive object={processed} />
    </group>
  );
}

function LogoFallback() {
  return (
    <Html center>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "999px",
          border: "3px solid rgba(148, 163, 184, 0.35)",
          borderTopColor: "rgba(148, 163, 184, 0.9)",
          animation: "animated-logo-spin 0.9s linear infinite",
        }}
      />
    </Html>
  );
}

export function AnimatedLogo3D() {
  const clearedRef = useRef(false);

  if (!clearedRef.current) {
    useGLTF.clear(MODEL_URL);
    clearedRef.current = true;
  }

  useEffect(() => {
    ensureSpinnerKeyframes();
    useGLTF.preload(MODEL_URL);
    return () => {
      useGLTF.clear(MODEL_URL);
    };
  }, []);

  return (
    <div
      style={{
        width: "88px",
        height: "88px",
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.2, 3], fov: 40 }}
        shadows
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[6, 8, 6]} intensity={1.1} castShadow />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} />
        <Suspense fallback={<LogoFallback />}>
          <LogoModel />
        </Suspense>
      </Canvas>
    </div>
  );
}
