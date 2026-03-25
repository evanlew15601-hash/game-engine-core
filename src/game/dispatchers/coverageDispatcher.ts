import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { Engine } from '../../engine/runtime/engine';
import type { Defs } from '../defs';
import type { Command } from '../command';
import { isDay } from '../time';
import { clamp01to100 } from './utils';

export function coverageDispatcher(): Dispatcher {
  return { dispatch };
}

function dispatch(engine: Engine<Defs>, cmd: unknown) {
  const c = cmd as Command;
  if (c.type !== 'SET_COVERAGE') return false;

  const { defs, world } = engine;
  if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return true;

  const entry = world.subscriptions.districts[c.district];
  if (!entry) return true;

  if (entry.emergency) {
    entry.emergency.prevTier = c.tier;
    world.log.push({ type: 'COVERAGE_SET', district: c.district, tier: c.tier });
    return true;
  }

  const prev = entry.tier;
  entry.tier = c.tier;

  if (prev !== 'NONE' && c.tier === 'NONE' && world.player.alignment === 'HERO') {
    world.city.publicTrust = clamp01to100(world.city.publicTrust - defs.subscriptions.trustPenaltyWhenDroppingCoverage);
  }

  world.log.push({ type: 'COVERAGE_SET', district: c.district, tier: c.tier });
  return true;
}
