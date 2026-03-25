import type { Defs as EngineDefs } from '../defs/defs';
import { loadWorld } from '../save/loadWorld';
import { saveWorld, type SaveFile } from '../save/save';
import type { World } from '../sim/world';
import type { Dispatcher } from './dispatcher';
import type { System } from './system';

export type Engine<Defs = EngineDefs> = {
  defs: Defs;
  world: World;
  systems: Array<System>;
  dispatchers: Array<Dispatcher>;
  save: () => SaveFile;
  load: (save: SaveFile) => void;
};

export function createEngine<Defs = EngineDefs>(params: {
  defs: Defs;
  world: World;
  systems: Array<System>;
  dispatchers: Array<Dispatcher>;
}): Engine<Defs> {
  const engine: Engine<Defs> = {
    defs: params.defs,
    world: params.world,
    systems: params.systems,
    dispatchers: params.dispatchers,
    save: () => saveWorld(engine.world),
    load: (save) => {
      engine.world = loadWorld(save);
    },
  };

  return engine;
}

export type DefaultEngine = Engine<EngineDefs>;
