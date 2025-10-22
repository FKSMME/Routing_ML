import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HyperspeedPreset } from '@routing-ml/shared/components/hyperspeed/hyperspeedPresets';
import './Hyperspeed.css';

interface HyperspeedProps {
  preset: HyperspeedPreset;
  className?: string;
}

export function Hyperspeed({ preset, className = '' }: HyperspeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let animationFrameId: number;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let particles: THREE.Points;
    let trails: THREE.Points[] = [];

    const init = () => {
      // Scene setup
      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);

      // Camera setup
      camera = new THREE.PerspectiveCamera(
        75,
        container.clientWidth / container.clientHeight,
        0.1,
        2000
      );
      camera.position.z = 5;

      // Renderer setup
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(preset.backgroundColor, 1);
      container.appendChild(renderer.domElement);

      // Create particles
      const particleCount = preset.particleCount;
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);
      const velocities = new Float32Array(particleCount);
      const colors = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Position
        positions[i3] = (Math.random() - 0.5) * preset.particleSpread;
        positions[i3 + 1] = (Math.random() - 0.5) * preset.particleSpread;
        positions[i3 + 2] = (Math.random() - 0.5) * preset.particleSpread - 50;

        // Velocity
        velocities[i] = 0.5 + Math.random() * 0.5;

        // Color
        const color = new THREE.Color(preset.particleColors[Math.floor(Math.random() * preset.particleColors.length)]);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: preset.particleSize,
        vertexColors: true,
        transparent: true,
        opacity: preset.particleOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Create trails if enabled
      if (preset.trailLength > 0) {
        for (let t = 0; t < preset.trailLength; t++) {
          const trailGeometry = geometry.clone();
          const trailMaterial = new THREE.PointsMaterial({
            size: preset.particleSize * (1 - t / preset.trailLength),
            vertexColors: true,
            transparent: true,
            opacity: preset.particleOpacity * (1 - t / preset.trailLength) * 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const trail = new THREE.Points(trailGeometry, trailMaterial);
          trails.push(trail);
          scene.add(trail);
        }
      }

      // Lighting (for ambient effect)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      setIsLoading(false);
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!particles) return;

      const positions = particles.geometry.attributes.position.array as Float32Array;
      const velocities = particles.geometry.attributes.velocity.array as Float32Array;

      // Update particle positions
      for (let i = 0; i < positions.length; i += 3) {
        const velocity = velocities[i / 3];
        positions[i + 2] += preset.speed * velocity;

        // Reset particles that go past camera
        if (positions[i + 2] > 5) {
          positions[i + 2] = -50;
          positions[i] = (Math.random() - 0.5) * preset.particleSpread;
          positions[i + 1] = (Math.random() - 0.5) * preset.particleSpread;
        }
      }

      particles.geometry.attributes.position.needsUpdate = true;

      // Update trails
      if (trails.length > 0) {
        // Shift trail positions
        for (let t = trails.length - 1; t > 0; t--) {
          const currentTrail = trails[t].geometry.attributes.position.array as Float32Array;
          const prevTrail = trails[t - 1].geometry.attributes.position.array as Float32Array;
          currentTrail.set(prevTrail);
          trails[t].geometry.attributes.position.needsUpdate = true;
        }

        // Update first trail from main particles
        if (trails[0]) {
          const firstTrail = trails[0].geometry.attributes.position.array as Float32Array;
          firstTrail.set(positions);
          trails[0].geometry.attributes.position.needsUpdate = true;
        }
      }

      // Camera movement
      camera.position.x += (preset.cameraShake ? (Math.random() - 0.5) * 0.02 : 0);
      camera.position.y += (preset.cameraShake ? (Math.random() - 0.5) * 0.02 : 0);
      camera.rotation.z += preset.cameraRotation;

      renderer.render(scene, camera);
    };

    const handleResize = () => {
      if (!container || !camera || !renderer) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    // Initialize and start animation
    init();
    animate();

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);

      if (renderer) {
        renderer.dispose();
        container.removeChild(renderer.domElement);
      }

      if (particles) {
        particles.geometry.dispose();
        (particles.material as THREE.Material).dispose();
      }

      trails.forEach(trail => {
        trail.geometry.dispose();
        (trail.material as THREE.Material).dispose();
      });
    };
  }, [preset]);

  return (
    <div
      ref={containerRef}
      className={`hyperspeed-container ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        zIndex: 0
      }}
    >
      {isLoading && (
        <div className="hyperspeed-loading">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
}
