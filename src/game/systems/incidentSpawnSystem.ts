import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { isNight } from '../time';
import { allocId, worldRng } from '../../engine/sim/world';

export function incidentSpawnSystem(): System {
  return { onTick: runIncidentSpawns };
}

function runIncidentSpawns(engine: Engine<Defs>) {
  const { defs, world } = engine;

  if (!isNight(defs.rules.ticksPerDay, world.time.tick)) return;
  if (world.incidents.filter((i) => i.state === 'OPEN').length >= defs.rules.maxActiveIncidents) return;

  const rng = worldRng(world);

  const heatFactor = 1 + world.city.heat / 80;
  const trustFactor =
    world.player.alignment === 'HERO'
      ? 1 + (50 - world.city.publicTrust) / 200
      : 1 + (50 - world.city.underworldFavor) / 200;

  const chance = defs.incidents.spawn.baseChancePerTick * heatFactor * trustFactor;

  if (rng.nextFloat01() > chance) return;

  const chosen = chooseIncidentArchetype(defs, world.player.alignment, rng);
  const severity = rng.int(chosen.minSeverity, chosen.maxSeverity);
  const deadline = world.time.tick + rng.int(chosen.deadlineTicks.min, chosen.deadlineTicks.max);

  const incidentId = allocId(world, 'incident');
  const district = chooseDistrictWeighted(rng, world.subscriptions.districts, defs.subscriptions.tiers);

  const sub = world.subscriptions.districts[district];
  const slaTier = sub?.tier ?? 'NONE';
  const window = defs.subscriptions.tiers[slaTier].slaWindowTicks;
  const responseByTick = slaTier !== 'NONE' && window > 0 ? world.time.tick + window : null;

  world.incidents.push({
    id: incidentId,
    kind: chosen.kind,
    district,
    tags: chosen.tags,
    severity,
    createdTick: world.time.tick,
    deadlineTick: deadline,
    responseByTick,
    slaTier,
    responseMissed: false,
    intelTravelBonusTicks: 0,
    state: 'OPEN',
    alignment: chosen.alignment,
  });

  world.log.push({
    type: 'INCIDENT_SPAWNED',
    incidentId,
    kind: chosen.kind,
    district,
    tags: chosen.tags,
    severity,
    deadlineTick: deadline,
  });
}

function chooseIncidentArchetype(defs: Defs, alignment: 'HERO' | 'VILLAIN', rng: ReturnType<typeof worldRng>) {
  const eligible = defs.incidents.archetypes.filter((a) => a.alignment === 'ANY' || a.alignment === alignment);
  const pool = eligible.length > 0 ? eligible : defs.incidents.archetypes;

  const total = pool.reduce((sum, a) => sum + a.weight, 0);
  let roll = rng.nextFloat01() * total;
  for (const a of pool) {
    roll -= a.weight;
    if (roll <= 0) return a;
  }
  return pool[pool.length - 1];
}

function chooseDistrictWeighted(
  rng: ReturnType<typeof worldRng>,
  subs: Engine<Defs>['world']['subscriptions']['districts'],
  tiers: Defs['subscriptions']['tiers'],
) {
  const entries = Object.entries(subs);
  if (entries.length === 0) return 'Unknown';

  let total = 0;
  const weights = entries.map(([district, s]) => {
    const base = tiers[s.tier].incidentSpawnWeight;
    const dissatisfaction = 1 + (100 - s.satisfaction) / 120;
    const demand = s.demand ?? 1;
    const w = Math.max(0.1, base * dissatisfaction * demand);
    total += w;
    return { district, w };
  });

  let roll = rng.nextFloat01() * total;
  for (const it of weights) {
    roll -= it.w;
    if (roll <= 0) return it.district;
  }

  return weights[weights.length - 1].district;
}
