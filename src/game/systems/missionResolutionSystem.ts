import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { worldRng } from '../../engine/sim/world';
import { clamp01to100, computeCoverageBonus } from './utils';

export function missionResolutionSystem(): System {
  return { onTick: runMissionResolution };
}

function runMissionResolution(engine: Engine<Defs>) {
  const { world } = engine;

  for (const mission of world.missions) {
    if (mission.phase !== 'ENGAGE') continue;
    if (mission.remainingTicks > 0) continue;

    const incident = world.incidents.find((i) => i.id === mission.incidentId);
    if (incident && incident.state !== 'FAILED') {
      resolveEngagement(engine, mission.id);
    }
  }
}

function resolveEngagement(engine: Engine<Defs>, missionId: string) {
  const { defs, world } = engine;
  const mission = world.missions.find((m) => m.id === missionId);
  if (!mission) return;

  const incident = world.incidents.find((i) => i.id === mission.incidentId);
  if (!incident) return;

  const allAgents = [...world.rosters.HERO, ...world.rosters.VILLAIN, ...world.rosters.ROGUE];
  const team = mission.agentIds
    .map((id) => allAgents.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const rng = worldRng(world);

  const basePower = team.reduce((sum, a) => sum + a.power, 0);
  const fatiguePenalty = team.reduce((sum, a) => sum + a.fatigue, 0) / 50;
  const coverageBonus = computeCoverageBonus(defs, incident.tags, team);

  const tactic = defs.tactics[mission.tactic];

  const score = (basePower + coverageBonus - fatiguePenalty) * tactic.scoreMultiplier;
  const difficulty = incident.severity * 10 + incident.tags.length * 6;
  const roll = rng.int(-12, 12);
  const delta = score - difficulty + roll;

  let outcome: 'FAIL' | 'PARTIAL' | 'SUCCESS' | 'CLEAN' = 'FAIL';
  if (delta >= 18) outcome = 'CLEAN';
  else if (delta >= 6) outcome = 'SUCCESS';
  else if (delta >= -6) outcome = 'PARTIAL';

  if (mission.lateByTicks > 0) {
    outcome =
      outcome === 'CLEAN'
        ? 'SUCCESS'
        : outcome === 'SUCCESS'
          ? 'PARTIAL'
          : outcome === 'PARTIAL'
            ? 'FAIL'
            : 'FAIL';
  }

  const collateralBase = Math.max(0, Math.round((incident.severity * 4 + incident.tags.length * 2) * tactic.collateralMultiplier));
  const collateral =
    outcome === 'CLEAN'
      ? Math.floor(collateralBase * 0.25)
      : outcome === 'SUCCESS'
        ? Math.floor(collateralBase * 0.6)
        : outcome === 'PARTIAL'
          ? collateralBase
          : Math.floor(collateralBase * 1.6);

  const injuryChance = clamp01(0.08 * incident.severity * tactic.injuryMultiplier + 0.01 * fatiguePenalty);
  let injuries = 0;

  for (const a of team) {
    if (rng.nextFloat01() < injuryChance && a.status.type === 'ON_MISSION') {
      injuries += 1;
      a.status = { type: 'INJURED', untilTick: world.time.tick + 20 + rng.int(0, 25) };
    }
  }

  if (outcome === 'FAIL') {
    incident.state = 'FAILED';
    world.city.stability = clamp01to100(world.city.stability - defs.city.stabilityLossPerFailedIncident);
    world.city.heat = clamp01to100(world.city.heat + 4 + collateral / 10);

    const sub = world.subscriptions.districts[incident.district];
    if (sub && sub.tier !== 'NONE') {
      sub.slaMissesThisPeriod += 1;
      const penalty = defs.subscriptions.satisfactionLossOnFail + (world.player.alignment === 'VILLAIN' ? defs.subscriptions.alignment.villainSatisfactionPenaltyOnFail : 0);
      sub.satisfaction = clamp01to100(sub.satisfaction - penalty);
    }
  } else {
    incident.state = 'RESOLVED';
    world.city.stability = clamp01to100(world.city.stability + defs.city.stabilityGainPerSuccess);

    const trustDelta = outcome === 'CLEAN' ? 4 : outcome === 'SUCCESS' ? 2 : 0;
    const underworldDelta = outcome === 'PARTIAL' ? 1 : 0;

    const sub = world.subscriptions.districts[incident.district];
    if (sub && sub.tier !== 'NONE') {
      const gain = defs.subscriptions.satisfactionGainOnSuccess + (world.player.alignment === 'HERO' ? defs.subscriptions.alignment.heroSatisfactionBonusOnSuccess : 0);
      sub.satisfaction = clamp01to100(sub.satisfaction + gain);
    }

    if (world.player.alignment === 'HERO') {
      const bonus = incident.alignment === 'HERO' ? defs.city.heroOnlyTrustBonus : 0;
      world.city.publicTrust = clamp01to100(world.city.publicTrust + trustDelta + bonus - collateral / 20);
      world.city.underworldFavor = clamp01to100(world.city.underworldFavor + underworldDelta);
    } else {
      const bonusFavor = incident.alignment === 'VILLAIN' ? defs.city.villainOnlyFavorBonus : 0;
      const bonusHeat = incident.alignment === 'VILLAIN' ? defs.city.villainOnlyHeatGain : 0;

      world.city.underworldFavor = clamp01to100(world.city.underworldFavor + 3 + bonusFavor - collateral / 30);
      world.city.publicTrust = clamp01to100(world.city.publicTrust - 1);
      world.city.heat = clamp01to100(world.city.heat + 2 + bonusHeat);
    }
  }

  world.log.push({
    type: 'MISSION_RESOLVED',
    missionId,
    incidentId: incident.id,
    outcome,
    collateral,
    injuries,
  });

  // Transition to AFTERMATH phase so missionProgressSystem can free agents
  mission.phase = 'AFTERMATH';
  mission.remainingTicks = 2;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
