import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { isDay } from '../time';
import { allocId, worldRng } from '../../engine/sim/world';
import { pickTags } from './utils';

export function recruitmentRefreshSystem(): System {
  return { onTick: runRecruitmentRefresh };
}

export function refreshRecruitment(engine: Engine<Defs>) {
  const { defs, world } = engine;

  world.recruitment.nextRefreshTick = world.time.tick + defs.recruitment.refreshTicks;
  world.recruitment.candidates = [];

  const rng = worldRng(world);
  const names = ['Latch', 'Brightwire', 'Gravemind', 'Neon Pilgrim', 'Red Static', 'Mirage Atlas', 'Kiteglass', 'Spindle', 'Nocturne'];

  for (let i = 0; i < defs.recruitment.candidateCount; i++) {
    const moralityRoll = rng.nextFloat01();
    const morality = moralityRoll < 0.45 ? 'HERO' : moralityRoll < 0.8 ? 'VILLAIN' : 'ROGUE';

    const id = allocId(world, 'cand');
    const name = names[rng.int(0, names.length - 1)] + ' ' + String(rng.int(1, 99));

    const power = rng.int(18, 40);
    const preferredAlignment = rng.nextFloat01() < 0.5 ? 'HERO' : 'VILLAIN';
    const loyalty = morality === 'ROGUE' ? rng.int(35, 85) : 100;

    const tags = pickTags(rng, morality);

    world.recruitment.candidates.push({ id, name, morality, power, tags, loyalty, preferredAlignment });
  }

  const candidateIds = world.recruitment.candidates.map((c) => c.id);
  world.log.push({ type: 'RECRUIT_POOL_REFRESHED', candidateIds });
}

function runRecruitmentRefresh(engine: Engine<Defs>) {
  const { defs, world } = engine;

  if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return;
  if (world.time.tick < world.recruitment.nextRefreshTick) return;

  refreshRecruitment(engine);
}
