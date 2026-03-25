import type { Alignment } from '../../engine/defs/defs';
import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { Engine } from '../../engine/runtime/engine';
import type { Defs } from '../defs';
import type { Command } from '../command';
import { clamp01to100 } from './utils';

export function alignmentDispatcher(): Dispatcher {
  return { dispatch };
}

function dispatch(engine: Engine<Defs>, cmd: unknown) {
  const c = cmd as Command;
  if (c.type !== 'SET_ALIGNMENT') return false;

  const { defs, world } = engine;
  const next: Alignment = c.alignment;
  if (next === world.player.alignment) return true;

  const since = world.time.tick - world.player.lastSwitchTick;
  if (since < defs.alignment.switchCooldownTicks) return true;

  world.player.alignment = next;
  world.player.lastSwitchTick = world.time.tick;

  world.city.heat = clamp01to100(world.city.heat + defs.alignment.switchHeatPenalty);
  world.city.publicTrust = clamp01to100(world.city.publicTrust - defs.alignment.switchTrustPenalty);
  world.city.underworldFavor = clamp01to100(world.city.underworldFavor - defs.alignment.switchUnderworldPenalty);

  for (const r of world.rosters.ROGUE) {
    r.loyalty = clamp01to100(r.loyalty - defs.roster.rogue.loyaltyDecayOnSwitch);
  }

  world.log.push({ type: 'ALIGNMENT_SWITCHED', alignment: next });
  return true;
}
