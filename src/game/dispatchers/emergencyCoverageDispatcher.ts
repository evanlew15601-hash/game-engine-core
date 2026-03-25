import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { Engine } from '../../engine/runtime/engine';
import type { Defs } from '../defs';
import type { Command } from '../command';
import { isDay } from '../time';

export function emergencyCoverageDispatcher(): Dispatcher {
  return { dispatch };
}

function dispatch(engine: Engine<Defs>, cmd: unknown) {
  const c = cmd as Command;
  if (c.type !== 'BUY_EMERGENCY_COVERAGE') return false;

  const { defs, world } = engine;
  if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return true;

  const entry = world.subscriptions.districts[c.district];
  if (!entry) return true;

  const target = defs.subscriptions.emergencyCoverage.tier;
  if (entry.tier === 'PREMIUM' || entry.tier === target) return true;

  const cost = defs.subscriptions.emergencyCoverage.costCash;
  if (world.company.cash < cost) return true;

  if (entry.emergency) {
    entry.emergency.expiresTick = world.time.tick + defs.rules.ticksPerDay;
    world.company.cash -= cost;
    return true;
  }

  entry.emergency = {
    prevTier: entry.tier,
    expiresTick: world.time.tick + defs.rules.ticksPerDay,
  };

  entry.tier = target;
  world.company.cash -= cost;
  return true;
}
