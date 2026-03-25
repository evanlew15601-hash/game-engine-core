import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { Engine } from '../../engine/runtime/engine';
import type { Defs } from '../defs';
import type { Command } from '../command';
import { isDay } from '../time';
import { refreshRecruitment } from '../systems/recruitmentRefreshSystem';

export function recruitmentDispatcher(): Dispatcher {
  return { dispatch };
}

function dispatch(engine: Engine<Defs>, cmd: unknown) {
  const c = cmd as Command;
  if (c.type !== 'RECRUIT' && c.type !== 'REFRESH_RECRUITMENT') return false;

  const { defs, world } = engine;
  if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return true;

  if (c.type === 'REFRESH_RECRUITMENT') {
    if (world.time.tick < world.recruitment.manualRefresh.nextAllowedTick) return true;
    if (world.company.cash < defs.recruitment.manualRefresh.costCash) return true;

    world.company.cash -= defs.recruitment.manualRefresh.costCash;

    const ticksPerDay = defs.rules.ticksPerDay;
    const nextDayStart = (Math.floor(world.time.tick / ticksPerDay) + 1) * ticksPerDay;
    world.recruitment.manualRefresh.nextAllowedTick = nextDayStart;

    refreshRecruitment(engine);
    return true;
  }

  const idx = world.recruitment.candidates.findIndex((cand) => cand.id === c.candidateId);
  if (idx < 0) return true;

  const cand = world.recruitment.candidates[idx];

  if (cand.morality === 'HERO' && world.city.publicTrust < defs.recruitment.minTrustToRecruitHero) return true;
  if (cand.morality === 'VILLAIN' && world.city.underworldFavor < defs.recruitment.minFavorToRecruitVillain) return true;

  const agent = {
    id: cand.id,
    name: cand.name,
    morality: cand.morality,
    power: cand.power,
    tags: cand.tags,
    status: { type: 'AVAILABLE' } as const,
    fatigue: 0,
    loyalty: cand.loyalty,
    preferredAlignment: cand.preferredAlignment,
  };

  if (cand.morality === 'HERO') world.rosters.HERO.push(agent);
  else if (cand.morality === 'VILLAIN') world.rosters.VILLAIN.push(agent);
  else world.rosters.ROGUE.push(agent);

  world.recruitment.candidates.splice(idx, 1);
  world.log.push({ type: 'RECRUITED', agentId: agent.id, morality: agent.morality });
  return true;
}
