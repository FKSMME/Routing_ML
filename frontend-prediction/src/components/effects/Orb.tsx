import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Vec3 } from 'ogl';
import './Orb.css';

export default function Orb({ hue = 0, hoverIntensity = 0.2, rotateOnHover = true, forceHoverState = false }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new Renderer({ canvas, alpha: true, dpr: Math.min(window.devicePixelRatio, 2) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const vertex = /* glsl */ `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0, 1);
      }
    `;

    const fragment = /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform float uHue;
      uniform float uHoverIntensity;
      uniform vec2 uMouse;
      uniform vec2 uResolution;
      varying vec2 vUv;

      vec3 hsb2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0), 6.0)-3.0)-1.0, 0.0, 1.0);
        rgb = rgb*rgb*(3.0-2.0*rgb);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      void main() {
        vec2 st = vUv;
        vec2 mouseInfluence = uMouse * uHoverIntensity;

        float dist = length(st - 0.5 - mouseInfluence * 0.1);
        float orb = smoothstep(0.5, 0.45, dist);

        float angle = atan(st.y - 0.5, st.x - 0.5);
        float radius = length(st - 0.5);

        float wave1 = sin(angle * 3.0 + uTime * 0.5 + radius * 10.0) * 0.5 + 0.5;
        float wave2 = sin(angle * 5.0 - uTime * 0.3 + radius * 8.0) * 0.5 + 0.5;

        float pattern = wave1 * wave2;

        vec3 color1 = hsb2rgb(vec3(uHue / 360.0, 0.8, 0.9));
        vec3 color2 = hsb2rgb(vec3((uHue + 60.0) / 360.0, 0.9, 0.7));
        vec3 color3 = hsb2rgb(vec3((uHue + 120.0) / 360.0, 0.7, 0.8));

        vec3 color = mix(color1, color2, pattern);
        color = mix(color, color3, wave1);

        float glow = exp(-dist * 3.0) * 0.3;
        color += glow * hsb2rgb(vec3(uHue / 360.0, 0.5, 1.0));

        float alpha = orb * (0.8 + pattern * 0.2);

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uHue: { value: hue },
        uHoverIntensity: { value: hoverIntensity },
        uMouse: { value: new Vec3(0, 0) },
        uResolution: { value: new Vec3(canvas.width, canvas.height) }
      },
      transparent: true
    });

    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let isHovering = forceHoverState;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.targetY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handleMouseEnter = () => {
      isHovering = true;
    };

    const handleMouseLeave = () => {
      if (!forceHoverState) {
        isHovering = false;
        mouse.targetX = 0;
        mouse.targetY = 0;
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    const resize = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      renderer.setSize(width, height);
      program.uniforms.uResolution.value.set(width, height);
    };

    resize();
    window.addEventListener('resize', resize);

    let animationId: number;
    const animate = (time: number) => {
      animationId = requestAnimationFrame(animate);

      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      program.uniforms.uTime.value = time * 0.001;
      program.uniforms.uMouse.value.set(mouse.x, mouse.y);

      if (rotateOnHover && isHovering) {
        program.uniforms.uHue.value = (hue + time * 0.05) % 360;
      } else {
        program.uniforms.uHue.value = hue;
      }

      renderer.render({ scene: mesh });
    };

    animate(0);

    return () => {
      cancelAnimationFrame(animationId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', resize);
      geometry.remove();
      program.remove();
      renderer.remove();
    };
  }, [hue, hoverIntensity, rotateOnHover, forceHoverState]);

  return <canvas ref={canvasRef} className="orb-canvas" />;
}
