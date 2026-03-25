import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { Engine } from '../../engine/runtime/engine';
import type { Defs } from '../defs';
import type { Command } from '../command';
import { isDay, isNight } from '../time';
import { allocId, worldRng } from '../../engine/sim/world';
import { clamp01, clamp01to100 } from './utils';
import { computeTravelTicks } from '../cityTravel';

export function missionDispatchDispatcher(): Dispatcher {
  return { dispatch };
}

function dispatch(engine: Engine<Defs>, cmd: unknown) {
  const c = cmd as Command;
  if (c.type !== 'DISPATCH_TEAM') return false;

  const { defs, world } = engine;

  if (!isNight(defs.rules.ticksPerDay, world.time.tick)) {
    if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return true;
    if (!c.overtime) return true;

    const cost = defs.rules.overtimeDispatch.costCash;
    if (world.company.cash < cost) return true;

    world.company.cash -= cost;
    world.city.heat = clamp01to100(world.city.heat + defs.rules.overtimeDispatch.heatGain);
  }

  const incident = world.incidents.find((i) => i.id === c.incidentId);
  if (!incident || incident.state !== 'OPEN') return true;
  if (incident.alignment !== 'ANY' && incident.alignment !== world.player.alignment) return true;

  const uniqueAgentIds = Array.from(new Set(c.agentIds));
  if (uniqueAgentIds.length === 0) return true;

  const activeRoster = world.rosters[world.player.alignment];
  const pool = [...activeRoster, ...world.rosters.ROGUE];
  const agents = uniqueAgentIds
    .map((id) => pool.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  if (agents.length !== uniqueAgentIds.length) return true;
  if (agents.some((a) => a.status.type !== 'AVAILABLE')) return true;

  const rng = worldRng(world);
  for (const a of agents) {
    if (a.morality !== 'ROGUE') continue;

    const loyaltyFactor = 1 - clamp01(a.loyalty / 100);
    const mismatch = a.preferredAlignment !== world.player.alignment ? defs.roster.rogue.refuseMismatchBonus : 0;
    const refuseChance = clamp01(defs.roster.rogue.refuseBaseChanceAtZeroLoyalty * loyaltyFactor + mismatch);

    if (rng.nextFloat01() < refuseChance) return true;
  }

  const missionId = allocId(world, 'mission');

  for (const a of agents) {
    a.status = { type: 'ON_MISSION', missionId };

    const scaled = defs.roster.fatiguePerMission + (defs.roster.fatigueScaling.extraPerMissionAtMaxFatigue * clamp01(a.fatigue / 100));
    a.fatigue = clamp01to100(a.fatigue + scaled);
  }

  incident.state = 'ASSIGNED';

  const travelTicks = computeTravelTicks({
    districts: defs.subscriptions.districts,
    district: incident.district,
    severity: incident.severity,
    heat: world.city.heat,
    intelBonusTicks: incident.intelTravelBonusTicks,
  });

  world.missions.push({
    id: missionId,
    incidentId: incident.id,
    agentIds: agents.map((a) => a.id),
    tactic: c.tactic,
    phase: 'TRAVEL',
    remainingTicks: travelTicks,
    departTick: world.time.tick,
    arrivalTick: null,
    lateByTicks: 0,
  });

  world.log.push({
    type: 'DISPATCHED',
    missionId,
    incidentId: incident.id,
    agentIds: agents.map((a) => a.id),
    tactic: c.tactic,
  });

  return true;
}
