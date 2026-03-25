import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';

export function emergencyCoverageExpirySystem(): System {
  return { onTick: runEmergencyCoverageExpiry };
}

function runEmergencyCoverageExpiry(engine: Engine<Defs>) {
  const { world } = engine;

  for (const [_district, sub] of Object.entries(world.subscriptions.districts)) {
    if (!sub.emergency) continue;
    if (world.time.tick < sub.emergency.expiresTick) continue;

    const restore = sub.emergency.prevTier;
    sub.emergency = undefined;
    sub.tier = restore;
  }
}
