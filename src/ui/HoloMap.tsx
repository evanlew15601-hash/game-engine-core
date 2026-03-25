import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { computeCityMapLayout } from '../game/cityTravel';

export type HoloMapIncident = {
  id: string;
  district: string;
  kind: string;
  severity: number;
  deadlineTicksLeft: number;
  selected: boolean;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export type HoloMapHover = null | {
  district: string;
  x: number;
  y: number;
};

export type HoloMapLayout = {
  hq: { x: number; y: number };
  nodes: Array<{ district: string; x: number; y: number }>;
};

export function computeHoloMapLayout(districts: string[]): HoloMapLayout {
  return computeCityMapLayout(districts);
}

export function HoloMap(props: {
  title: string;
  districts: string[];
  coverageByDistrict: Record<string, { tier: string; satisfaction: number }>;
  incidents: HoloMapIncident[];
  etaByDistrict?: Record<string, number>;
  selectedDistrict: string | null;
  hoverDistrict?: string | null;
  onSelectDistrict: (district: string) => void;
  onHover?: (hover: HoloMapHover) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const layout = useMemo(() => computeHoloMapLayout(props.districts), [props.districts]);
  const nodes = layout.nodes;
  const hq = layout.hq;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    const noise = document.createElement('canvas');
    noise.width = 256;
    noise.height = 256;
    const nctx = noise.getContext('2d');
    if (nctx) {
      const img = nctx.createImageData(noise.width, noise.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(Math.random() * 255);
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.floor(Math.random() * 90);
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

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#050a12';
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#2a90ff';
      ctx.lineWidth = 1;
      const grid = 28;
      for (let x = 0; x <= w; x += grid) {
        ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += grid) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Vignette
      const g = ctx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.1, w * 0.5, h * 0.5, Math.min(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Connections
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#2a90ff';
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]; const b = nodes[j];
          const ax = a.x * w; const ay = a.y * h;
          const bx = b.x * w; const by = b.y * h;
          const dx = ax - bx; const dy = ay - by;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > Math.min(w, h) * 0.42) continue;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      const incidentByDistrict: Record<string, HoloMapIncident[]> = {};
      for (const inc of props.incidents) {
        (incidentByDistrict[inc.district] ??= []).push(inc);
      }

      const soonestResponseWindowLeftByDistrict: Record<string, number> = {};
      for (const d of Object.keys(incidentByDistrict)) {
        const incs = incidentByDistrict[d];
        soonestResponseWindowLeftByDistrict[d] = incs.reduce((m, ii) => Math.min(m, ii.deadlineTicksLeft), Number.POSITIVE_INFINITY);
      }

      // HQ
      const hx = hq.x * w;
      const hy = hq.y * h;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#2a90ff';
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#081222';
      ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a90ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#b8d6ff';
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('HQ', hx, hy + 18);
      ctx.globalAlpha = 1;

      // Route to selected
      if (props.selectedDistrict) {
        const dest = nodes.find((n) => n.district === props.selectedDistrict);
        if (dest) {
          const dx = dest.x * w; const dy = dest.y * h;
          const eta = props.etaByDistrict?.[props.selectedDistrict] ?? null;
          const soonest = soonestResponseWindowLeftByDistrict[props.selectedDistrict] ?? Number.POSITIVE_INFINITY;
          const lateBy = eta === null || !Number.isFinite(soonest) ? 0 : Math.max(0, eta - soonest);

          ctx.save();
          ctx.globalAlpha = lateBy > 0 ? 0.95 : 0.9;
          ctx.strokeStyle = lateBy > 0 ? '#ff3b4e' : '#5cffc6';
          ctx.lineWidth = 2;
          ctx.setLineDash(lateBy > 0 ? [3, 7] : [8, 10]);
          ctx.lineDashOffset = -t * (lateBy > 0 ? 30 : 18);
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(dx, dy); ctx.stroke();
          ctx.restore();
        }
      }

      // Route to hover
      if (props.hoverDistrict && props.hoverDistrict !== props.selectedDistrict) {
        const dest = nodes.find((n) => n.district === props.hoverDistrict);
        if (dest) {
          const dx = dest.x * w; const dy = dest.y * h;
          const eta = props.etaByDistrict?.[props.hoverDistrict] ?? null;
          const soonest = soonestResponseWindowLeftByDistrict[props.hoverDistrict] ?? Number.POSITIVE_INFINITY;
          const lateBy = eta === null || !Number.isFinite(soonest) ? 0 : Math.max(0, eta - soonest);

          ctx.save();
          ctx.globalAlpha = lateBy > 0 ? 0.75 : 0.55;
          ctx.strokeStyle = lateBy > 0 ? '#ffb020' : '#2a90ff';
          ctx.lineWidth = 2;
          ctx.setLineDash(lateBy > 0 ? [3, 9] : [4, 10]);
          ctx.lineDashOffset = -t * (lateBy > 0 ? 26 : 24);
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(dx, dy); ctx.stroke();
          ctx.restore();
        }
      }

      // Nodes
      for (const n of nodes) {
        const x = n.x * w; const y = n.y * h;
        const cov = props.coverageByDistrict[n.district];
        const tier = cov?.tier ?? 'NONE';

        const incidents = incidentByDistrict[n.district] ?? [];
        const worstSev = incidents.reduce((m, ii) => Math.max(m, ii.severity), 0);

        const isSelected = props.selectedDistrict === n.district;
        const isHovered = props.hoverDistrict === n.district;

        const base = tier === 'PREMIUM' ? '#5cffc6' : tier === 'BASIC' ? '#2a90ff' : '#2c3b52';
        const eta = props.etaByDistrict?.[n.district] ?? null;
        const soonest = soonestResponseWindowLeftByDistrict[n.district] ?? Number.POSITIVE_INFINITY;
        const lateBy = eta === null || !Number.isFinite(soonest) ? 0 : Math.max(0, eta - soonest);

        const danger = lateBy > 0 ? '#ff3b4e' : worstSev >= 8 ? '#ff3b4e' : worstSev >= 5 ? '#ffb020' : null;

        ctx.globalAlpha = isHovered ? 0.95 : 0.75;
        ctx.fillStyle = danger ?? base;
        ctx.beginPath(); ctx.arc(x, y, isSelected ? 14 : isHovered ? 13 : 11, 0, Math.PI * 2); ctx.fill();

        ctx.globalAlpha = 1;
        ctx.fillStyle = '#081222';
        ctx.beginPath(); ctx.arc(x, y, isSelected ? 9 : 7, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = base; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, isSelected ? 16 : 13, 0, Math.PI * 2); ctx.stroke();

        // Incident pings
        if (incidents.length > 0) {
          const pulseSpeed = lateBy > 0 ? 4.2 : 2.5;
          const pulse = (Math.sin(t * pulseSpeed) * 0.5 + 0.5) * 0.65 + 0.25;
          ctx.globalAlpha = 0.25 + pulse * (lateBy > 0 ? 0.5 : 0.35);
          ctx.strokeStyle = danger ?? '#ffb020';
          ctx.lineWidth = lateBy > 0 ? 3 : 2;
          ctx.beginPath(); ctx.arc(x, y, (isSelected ? 22 : 19) + pulse * (lateBy > 0 ? 14 : 10), 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;

          const soonestInc = incidents.reduce((m, ii) => Math.min(m, ii.deadlineTicksLeft), Number.POSITIVE_INFINITY);
          const badgeText = String(incidents.length) + ' • ' + String(Math.max(0, Math.round(soonestInc)));

          const topKind = incidents.slice().sort((a, b) => b.severity - a.severity).map((ii) => ii.kind).find((k) => Boolean(k)) ?? '?';
          const glyph = topKind.trim().slice(0, 1).toUpperCase();

          const bw = ctx.measureText(badgeText).width + 36;
          const bh = 18;
          const bx = x + (isSelected ? 18 : 16);
          const by = y - (isSelected ? 28 : 26);

          ctx.globalAlpha = 0.9;
          ctx.fillStyle = 'rgba(8, 18, 34, 0.9)';
          roundRect(ctx, bx - bw / 2, by - bh / 2, bw, bh, 9); ctx.fill();

          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = danger ?? '#ffb020'; ctx.lineWidth = 1;
          roundRect(ctx, bx - bw / 2, by - bh / 2, bw, bh, 9); ctx.stroke();

          ctx.globalAlpha = 0.95;
          ctx.fillStyle = danger ?? '#2a90ff';
          ctx.beginPath(); ctx.arc(bx - bw / 2 + 12, by, 7, 0, Math.PI * 2); ctx.fill();

          ctx.globalAlpha = 1;
          ctx.fillStyle = '#081222';
          ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(glyph, bx - bw / 2 + 12, by + 0.5);

          ctx.fillStyle = '#e9f3ff';
          ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx + 8, by + 0.5);
        }

        ctx.globalAlpha = 0.9;
        ctx.fillStyle = isSelected ? '#e9f3ff' : '#b8d6ff';
        ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(n.district, x, y + 18);
        ctx.globalAlpha = 1;
      }

      // Scanlines
      ctx.globalAlpha = 0.08; ctx.fillStyle = '#000';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y + ((t * 14) % 4), w, 1);
      }
      ctx.globalAlpha = 1;

      // Noise
      if (noise) {
        ctx.save(); ctx.globalAlpha = 0.08;
        ctx.translate(((t * 40) % 64) - 32, ((t * 23) % 64) - 32);
        ctx.drawImage(noise, 0, 0, w + 64, h + 64);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); };
  }, [nodes, props.coverageByDistrict, props.incidents, props.selectedDistrict, props.hoverDistrict, props.etaByDistrict, hq]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hitTest = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left; const y = clientY - rect.top;
      const w = rect.width; const h = rect.height;

      let best: { district: string; d2: number; x: number; y: number } | null = null;
      for (const n of nodes) {
        const nx = n.x * w; const ny = n.y * h;
        const dx = nx - x; const dy = ny - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 18 * 18 && (!best || d2 < best.d2)) best = { district: n.district, d2, x: nx, y: ny };
      }

      return { rect, best };
    };

    const onClick = (e: MouseEvent) => {
      const { best } = hitTest(e.clientX, e.clientY);
      if (best) props.onSelectDistrict(best.district);
    };

    const onMove = (e: MouseEvent) => {
      if (!props.onHover) return;
      const { rect, best } = hitTest(e.clientX, e.clientY);
      if (!best) { props.onHover(null); return; }
      props.onHover({ district: best.district, x: best.x + rect.left, y: best.y + rect.top });
    };

    const onLeave = () => { if (props.onHover) props.onHover(null); };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    return () => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, [nodes, props]);

  return (
    <div className="rounded-xl border border-[hsl(215,50%,18%)] overflow-hidden bg-[hsl(220,60%,4%)]">
      <div className="px-3 py-2.5 border-b border-[hsl(215,50%,18%)] text-[hsl(210,60%,80%)] font-bold text-sm">
        {props.title}
      </div>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 320 }} />
      <div className="px-3 py-2 border-t border-[hsl(215,50%,18%)] text-[hsl(210,40%,65%)] text-xs opacity-90">
        Click a district node to focus. Coverage tier controls ring color; active incidents pulse.
      </div>
    </div>
  );
}
