import type { Engine } from './engine';

export type Dispatcher = {
  dispatch: (engine: Engine<any>, cmd: unknown) => boolean;
};
