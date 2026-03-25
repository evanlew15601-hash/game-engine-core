import type { World } from '../sim/world';

export type SaveFile = {
  version: 1;
  world: World;
};

export function saveWorld(world: World): SaveFile {
  return {
    version: 1,
    world: structuredClone(world),
  };
}
