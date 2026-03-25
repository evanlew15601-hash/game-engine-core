export type CityMapLayout = {
  hq: { x: number; y: number };
  nodes: Array<{ district: string; x: number; y: number }>;
};

export function computeCityMapLayout(districts: string[]): CityMapLayout {
  const order = districts;
  const nodes: Array<{ district: string; x: number; y: number }> = [];

  const presets: Record<string, { x: number; y: number }> = {
    Downtown: { x: 0.52, y: 0.5 },
    Uptown: { x: 0.58, y: 0.28 },
    OldCity: { x: 0.36, y: 0.44 },
    'Old City': { x: 0.36, y: 0.44 },
    Harbor: { x: 0.7, y: 0.62 },
    Industrial: { x: 0.42, y: 0.72 },
  };

  for (let i = 0; i < order.length; i++) {
    const d = order[i];
    const preset = presets[d];
    if (preset) {
      nodes.push({ district: d, x: preset.x, y: preset.y });
    } else {
      const t = (i / Math.max(1, order.length)) * Math.PI * 2;
      nodes.push({ district: d, x: 0.52 + Math.cos(t) * 0.22, y: 0.52 + Math.sin(t) * 0.22 });
    }
  }

  return { hq: { x: 0.18, y: 0.78 }, nodes };
}

export function computeTravelTicks(params: {
  districts: string[];
  district: string;
  severity: number;
  heat: number;
  intelBonusTicks?: number;
}) {
  const { hq, nodes } = computeCityMapLayout(params.districts);
  const dest = nodes.find((n) => n.district === params.district);
  const intel = params.intelBonusTicks ?? 0;

  if (!dest) {
    return Math.max(1, 4 + Math.floor(params.severity / 3) + Math.floor(params.heat / 40) - intel);
  }

  const dx = dest.x - hq.x;
  const dy = dest.y - hq.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const distTicks = Math.max(1, Math.round(dist * 8));
  const threatTicks = Math.floor(params.severity / 3);
  const heatTicks = Math.floor(params.heat / 40);

  return Math.max(1, 2 + distTicks + threatTicks + heatTicks - intel);
}
