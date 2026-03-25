import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';

export function subscriptionDemandSystem(): System {
  return { onTick: runDemand };
}

function runDemand(engine: Engine<Defs>) {
  const { defs, world } = engine;
  if (world.subscriptions.lastBilledTick !== world.time.tick) return;

  for (const sub of Object.values(world.subscriptions.districts)) {
    const d = defs.subscriptions.demand;
    const sat = sub.satisfaction;

    let next = sub.demand ?? 1;

    if (sat <= d.lowSatisfactionThreshold) {
      next += d.increasePerBilling;
    } else if (sat >= d.highSatisfactionThreshold) {
      next -= d.decreasePerBilling;
    }

    next = Math.max(d.min, Math.min(d.max, next));
    sub.demand = next;
  }
}
