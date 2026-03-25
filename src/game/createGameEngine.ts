import { createEngine, type Engine } from '../engine';
import type { World } from '../engine/sim/world';
import type { FeatureToggles } from './features';
import { createDefaultFeatures } from './features';
import type { Defs } from './defs';
import { createDefaultDispatchers } from './dispatchers/defaultDispatchers';
import { createDefaultSystems } from './systems/defaultSystems';

export function createGameEngine(params: {
  defs: Defs;
  world: World;
  features?: FeatureToggles;
}): Engine<Defs> {
  const features = params.features ?? createDefaultFeatures();

  return createEngine<Defs>({
    defs: params.defs,
    world: params.world,
    systems: createDefaultSystems(features),
    dispatchers: createDefaultDispatchers(features),
  });
}
