import type { Engine } from './engine';

export type System = {
  onTick: (engine: Engine<any>) => void;
};
