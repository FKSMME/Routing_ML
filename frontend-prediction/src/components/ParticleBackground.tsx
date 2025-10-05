import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasSize();

    const particles: Particle[] = [];
    const particleCount = 150; // 먼지 파티클 수 증가
    const colors = [
      'rgba(14, 165, 233, ', // cyan
      'rgba(168, 85, 247, ', // purple
      'rgba(16, 185, 129, ', // green
      'rgba(236, 72, 153, ', // pink
      'rgba(245, 158, 11, ', // amber
    ];

    // 파티클 생성 함수 - 먼지 느낌 강화
    const createParticle = (): Particle => {
      const life = Math.random() * 300 + 150; // 생명 주기 증가
      const isDust = Math.random() > 0.3; // 70%는 먼지 파티클
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * (isDust ? 0.8 : 1.5), // 먼지는 느리게
        vy: (Math.random() - 0.5) * (isDust ? 0.6 : 1.2) - 0.3, // 약간 위로 떠오르는 효과
        size: isDust ? Math.random() * 2 + 0.3 : Math.random() * 4 + 0.5,
        opacity: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 0,
        maxLife: life,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * (isDust ? 0.03 : 0.08),
      };
    };

    // 파티클 초기화
    for (let i = 0; i < particleCount; i++) {
      particles.push(createParticle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle, index) => {
        // 생명주기 업데이트
        particle.life++;
        if (particle.life >= particle.maxLife) {
          particles[index] = createParticle();
          return;
        }

        // 페이드 인/아웃 효과
        const lifeRatio = particle.life / particle.maxLife;
        if (lifeRatio < 0.1) {
          particle.opacity = lifeRatio * 10;
        } else if (lifeRatio > 0.9) {
          particle.opacity = (1 - lifeRatio) * 10;
        } else {
          particle.opacity = Math.min(1, particle.opacity + 0.02);
        }

        // 파티클 이동 (먼지가 일렁이는 느낌)
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;

        // 경계 밖으로 나가면 재생성
        if (particle.x < -50 || particle.x > canvas.width + 50 ||
            particle.y < -50 || particle.y > canvas.height + 50) {
          particles[index] = createParticle();
          return;
        }

        // 파티클 그리기 (글로우 효과)
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size * 4);
        gradient.addColorStop(0, `${particle.color}${particle.opacity})`);
        gradient.addColorStop(0.4, `${particle.color}${particle.opacity * 0.6})`);
        gradient.addColorStop(1, `${particle.color}0)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // 코어 (밝은 중심)
        ctx.fillStyle = `${particle.color}${particle.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    window.addEventListener('resize', setCanvasSize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', setCanvasSize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-50"
      style={{ mixBlendMode: 'screen' }}
      aria-hidden="true"
    />
  );
}
