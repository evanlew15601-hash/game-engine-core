import type { SaveFile } from './save';
import type { World } from '../sim/world';

export function loadWorld(save: SaveFile): World {
  if (save.version !== 1) {
    throw new Error(`Unsupported save version: ${String((save as SaveFile).version)}`);
  }

  return structuredClone(save.world);
}
