import { useRef, useEffect } from 'react';

interface BallpitSimpleProps {
  count?: number;
  followCursor?: boolean;
}

const BallpitSimple = ({ count = 50, followCursor = true }: BallpitSimpleProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simple balls
    const balls: Array<{ x: number; y: number; vx: number; vy: number; r: number; color: string }> = [];
    const colors = ['#667eea', '#764ba2', '#38bdf8', '#f472b6', '#a78bfa'];

    for (let i = 0; i < count; i++) {
      balls.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        r: 5 + Math.random() * 15,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const mouse = { x: canvas.width / 2, y: canvas.height / 2 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    if (followCursor) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      balls.forEach(ball => {
        // Attraction to mouse if followCursor is enabled
        if (followCursor) {
          const dx = mouse.x - ball.x;
          const dy = mouse.y - ball.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 50) {
            ball.vx += (dx / dist) * 0.1;
            ball.vy += (dy / dist) * 0.1;
          }
        }

        // Friction
        ball.vx *= 0.95;
        ball.vy *= 0.95;

        // Update position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Bounce off walls
        if (ball.x < ball.r || ball.x > canvas.width - ball.r) {
          ball.vx *= -0.8;
          ball.x = Math.max(ball.r, Math.min(canvas.width - ball.r, ball.x));
        }
        if (ball.y < ball.r || ball.y > canvas.height - ball.r) {
          ball.vy *= -0.8;
          ball.y = Math.max(ball.r, Math.min(canvas.height - ball.r, ball.y));
        }

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();

        // Glow effect
        const gradient = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 2);
        gradient.addColorStop(0, ball.color + 'aa');
        gradient.addColorStop(1, ball.color + '00');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
      if (followCursor) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, [count, followCursor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  );
};

export default BallpitSimple;
