import { useEffect, useRef } from 'react';

/** Lightweight canvas snow overlay. Respects prefers-reduced-motion. */
export function Snowfall({ count = 140 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = canvas.clientWidth;
      h = canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const flakes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.8 + Math.random() * 2.2,
      vy: 0.3 + Math.random() * 0.9,
      drift: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const f of flakes) {
        f.y += f.vy;
        f.drift += 0.01;
        f.x += Math.sin(f.drift) * 0.4;
        if (f.y > h + 4) {
          f.y = -4;
          f.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [count]);

  return <canvas ref={ref} className="snowfall" aria-hidden="true" />;
}
