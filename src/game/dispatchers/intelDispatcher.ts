import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { Engine } from '../../engine/runtime/engine';
import type { Defs } from '../defs';
import type { Command } from '../command';
import { isDay } from '../time';
import { allocId, worldRng } from '../../engine/sim/world';
import { clamp01, clamp01to100 } from './utils';

export function intelDispatcher(): Dispatcher {
  return { dispatch };
}

function dispatch(engine: Engine<Defs>, cmd: unknown) {
  const c = cmd as Command;
  if (c.type !== 'BUY_INTEL') return false;

  const { defs, world } = engine;
  if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return true;

  const incident = world.incidents.find((i) => i.id === c.incidentId);
  if (!incident || incident.state !== 'OPEN') return true;

  const tier = defs.intel.tiers[c.tier];
  const rogue = world.rosters.ROGUE.find((r) => r.id === c.rogueId);
  if (!rogue || rogue.status.type !== 'AVAILABLE') return true;
  if (rogue.loyalty < tier.minRogueLoyalty) return true;

  if (world.player.alignment === 'HERO') {
    if (world.city.publicTrust < tier.trustCost) return true;
    world.city.publicTrust = clamp01to100(world.city.publicTrust - tier.trustCost);
  } else {
    if (world.city.underworldFavor < tier.favorCost) return true;
    world.city.underworldFavor = clamp01to100(world.city.underworldFavor - tier.favorCost);
  }

  world.city.heat = clamp01to100(world.city.heat + tier.heatGain);

  const rng = worldRng(world);
  const severityDelta = -rng.int(tier.severityReduction.min, tier.severityReduction.max);
  const deadlineDelta = rng.int(tier.deadlineExtensionTicks.min, tier.deadlineExtensionTicks.max);
  const travelBonus = rng.int(tier.travelTicksReduction.min, tier.travelTicksReduction.max);

  incident.severity = Math.max(1, incident.severity + severityDelta);
  incident.deadlineTick += deadlineDelta;
  incident.intelTravelBonusTicks = Math.max(0, (incident.intelTravelBonusTicks ?? 0) + travelBonus);

  const mismatch = rogue.preferredAlignment !== world.player.alignment;
  const loyaltyCost = tier.rogueLoyaltyCost + (mismatch ? tier.rogueMismatchExtraLoyaltyCost : 0);
  rogue.loyalty = clamp01to100(rogue.loyalty - loyaltyCost);

  world.log.push({ type: 'INTEL_BOUGHT', incidentId: incident.id, rogueId: rogue.id, tier: c.tier, severityDelta, deadlineDelta, travelBonusTicks: travelBonus });

  if (tier.followUp) {
    const followRoll = rng.nextFloat01();
    if (followRoll < clamp01(tier.followUp.chance)) {
      const followIncidentId = allocId(world, 'incident');
      const followDeadline = world.time.tick + rng.int(tier.followUp.deadlineTicks.min, tier.followUp.deadlineTicks.max);

      const sub = world.subscriptions.districts[incident.district];
      const slaTier = sub?.tier ?? 'NONE';
      const window = defs.subscriptions.tiers[slaTier].slaWindowTicks;
      const responseByTick = slaTier !== 'NONE' && window > 0 ? world.time.tick + window : null;

      world.incidents.push({
        id: followIncidentId,
        kind: tier.followUp.kind,
        district: incident.district,
        tags: [...incident.tags],
        severity: Math.max(1, incident.severity - 1),
        createdTick: world.time.tick,
        deadlineTick: followDeadline,
        responseByTick,
        slaTier,
        responseMissed: false,
        intelTravelBonusTicks: 0,
        state: 'OPEN',
        alignment: tier.followUp.alignment,
      });

      world.log.push({ type: 'FOLLOWUP_SPAWNED', incidentId: followIncidentId, kind: tier.followUp.kind, alignment: tier.followUp.alignment });
    }
  }

  return true;
}
