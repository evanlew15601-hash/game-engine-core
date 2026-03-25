import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { clamp01to100 } from './utils';

export function recoverySystem(): System {
  return { onTick: runRecovery };
}

function runRecovery(engine: Engine<Defs>) {
  const { defs, world } = engine;

  for (const roster of [world.rosters.HERO, world.rosters.VILLAIN, world.rosters.ROGUE]) {
    for (const a of roster) {
      a.fatigue = clamp01to100(a.fatigue - defs.roster.fatigueRecoveryPerTick);
      if (a.status.type === 'INJURED' && world.time.tick >= a.status.untilTick) {
        a.status = { type: 'AVAILABLE' };
      }
    }
  }
}
