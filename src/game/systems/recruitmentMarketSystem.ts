import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';

export function recruitmentMarketSystem(): System {
  return { onTick: runRecruitmentMarket };
}

function runRecruitmentMarket(_engine: Engine<Defs>) {
  // Reserved for future rules
}
