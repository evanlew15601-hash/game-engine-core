import { useEffect, useRef, useState } from 'react';

export function TitleScreen(props: { onStart: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    const noise = document.createElement('canvas');
    noise.width = 128;
    noise.height = 128;
    const nctx = noise.getContext('2d');
    if (nctx) {
      const img = nctx.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
        img.data[i + 3] = Math.floor(Math.random() * 60);
      }
      nctx.putImageData(img, 0, 0);
    }

    const draw = (now: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * devicePixelRatio) || canvas.height !== Math.floor(h * devicePixelRatio)) {
        canvas.width = Math.floor(w * devicePixelRatio);
        canvas.height = Math.floor(h * devicePixelRatio);
      }
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      const t = (now - start) / 1000;

      // Background
      ctx.fillStyle = '#020510';
      ctx.fillRect(0, 0, w, h);

      // Animated grid
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#2a90ff';
      ctx.lineWidth = 1;
      const grid = 40;
      const offset = (t * 8) % grid;
      for (let x = -grid + offset; x <= w + grid; x += grid) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }
      for (let y = -grid + offset * 0.6; y <= h + grid; y += grid) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Radial glow
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.min(w, h) * 0.6);
      glow.addColorStop(0, 'rgba(42, 144, 255, 0.08)');
      glow.addColorStop(0.5, 'rgba(42, 144, 255, 0.03)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Floating particles
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 30; i++) {
        const px = (Math.sin(t * 0.3 + i * 2.1) * 0.4 + 0.5) * w;
        const py = (Math.cos(t * 0.2 + i * 1.7) * 0.4 + 0.5) * h;
        const size = 1 + Math.sin(t + i) * 0.5;
        const alpha = 0.3 + Math.sin(t * 0.8 + i * 3) * 0.2;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 3 === 0 ? '#5cffc6' : i % 3 === 1 ? '#2a90ff' : '#ffb020';
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Pulsing district nodes (decorative)
      const nodes = [
        { x: 0.2, y: 0.3 }, { x: 0.75, y: 0.25 }, { x: 0.15, y: 0.7 },
        { x: 0.8, y: 0.65 }, { x: 0.5, y: 0.55 }, { x: 0.35, y: 0.5 },
        { x: 0.65, y: 0.45 },
      ];
      for (let i = 0; i < nodes.length; i++) {
        const nx = nodes[i].x * w;
        const ny = nodes[i].y * h;
        const pulse = Math.sin(t * 1.5 + i * 1.2) * 0.5 + 0.5;

        ctx.globalAlpha = 0.15 + pulse * 0.1;
        ctx.strokeStyle = i % 2 === 0 ? '#2a90ff' : '#5cffc6';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(nx, ny, 8 + pulse * 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#081222';
        ctx.beginPath();
        ctx.arc(nx, ny, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Connection lines between nearby nodes
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = '#2a90ff';
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = (nodes[i].x - nodes[j].x) * w;
          const dy = (nodes[i].y - nodes[j].y) * h;
          if (Math.sqrt(dx * dx + dy * dy) < Math.min(w, h) * 0.4) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x * w, nodes[i].y * h);
            ctx.lineTo(nodes[j].x * w, nodes[j].y * h);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Scanlines
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y + ((t * 12) % 3), w, 1);
      }
      ctx.globalAlpha = 1;

      // Noise
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.translate(((t * 30) % 64) - 32, ((t * 17) % 64) - 32);
      ctx.drawImage(noise, 0, 0, w + 64, h + 64);
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[hsl(220,60%,2%)]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {/* Title group */}
        <div className="text-center mb-12">
          <div className="text-[hsl(210,80%,50%)] text-xs font-mono tracking-[0.3em] uppercase mb-3 opacity-70">
            Magnate City Operations
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[hsl(210,60%,90%)] via-[hsl(210,80%,70%)] to-[hsl(210,80%,50%)]">
            DISPATCH SIM
          </h1>
          <div className="mt-4 text-[hsl(210,30%,55%)] text-sm md:text-base font-mono max-w-md mx-auto leading-relaxed">
            Run a superhero/villain dispatch agency. Manage contracts,
            deploy agents, and dominate the city.
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={props.onStart}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className={`
            relative px-10 py-4 rounded-lg font-bold text-base tracking-wider uppercase
            transition-all duration-300 cursor-pointer
            border-2
            ${hovering
              ? 'bg-[hsl(210,80%,50%)] border-[hsl(210,80%,60%)] text-white shadow-[0_0_30px_rgba(42,144,255,0.4)]'
              : 'bg-[hsl(210,80%,50%)]/10 border-[hsl(210,80%,50%)]/50 text-[hsl(210,80%,70%)] shadow-[0_0_15px_rgba(42,144,255,0.15)]'
            }
          `}
        >
          Begin Operations
        </button>

        {/* Info pills */}
        <div className="mt-10 flex gap-4 flex-wrap justify-center">
          {[
            ['⚡', 'Day/Night Cycle'],
            ['🎯', 'Incident Response'],
            ['💰', 'Subscription Economy'],
            ['🕵️', 'Intel & Rogues'],
          ].map(([icon, label]) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[hsl(215,30%,20%)] bg-[hsl(220,40%,6%)]/80 text-[hsl(210,40%,65%)] text-xs font-mono"
            >
              <span>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Flavor text */}
        <div className="mt-16 text-[hsl(210,20%,35%)] text-[11px] font-mono text-center max-w-sm">
          Day = plan subscriptions, buy intel, set coverage.
          <br />
          Night = dispatch agents to incidents.
          <br />
          Survive the billing cycle.
        </div>
      </div>
    </div>
  );
}
