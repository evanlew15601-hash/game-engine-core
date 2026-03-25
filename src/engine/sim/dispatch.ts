import type { Engine } from '../runtime/engine';

export function dispatch(engine: Engine<any>, cmd: unknown) {
  for (const d of engine.dispatchers) {
    if (d.dispatch(engine, cmd)) return;
  }
}
