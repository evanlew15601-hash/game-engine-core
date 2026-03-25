import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { clamp01to100 } from './utils';

export function subscriptionClientHealthSystem(): System {
  return { onTick: runClientHealth };
}

function runClientHealth(engine: Engine<Defs>) {
  const { defs, world } = engine;
  if (world.subscriptions.lastBilledTick !== world.time.tick) return;

  for (const [district, sub] of Object.entries(world.subscriptions.districts)) {
    sub.satisfaction = clamp01to100(sub.satisfaction + 2);

    if (sub.tier !== 'NONE' && sub.satisfaction <= defs.subscriptions.churn.cancelThreshold) {
      sub.tier = 'NONE';
      sub.emergency = undefined;
      world.log.push({ type: 'COVERAGE_SET', district, tier: 'NONE' });
      continue;
    }

    if (sub.tier !== 'NONE' && sub.satisfaction <= defs.subscriptions.churn.downgradeThreshold) {
      const downgraded = sub.tier === 'PREMIUM' ? 'BASIC' : 'NONE';
      if (downgraded !== sub.tier) {
        sub.tier = downgraded;
        sub.emergency = undefined;
        world.log.push({ type: 'COVERAGE_SET', district, tier: downgraded });
      }
    }
  }
}
