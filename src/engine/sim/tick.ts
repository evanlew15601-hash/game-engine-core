import type { Engine } from '../runtime/engine';

export function tick(engine: Engine<any>, ticks: number) {
  const n = Math.max(0, Math.floor(ticks));
  for (let i = 0; i < n; i++) {
    tickOnce(engine);
  }
}

function tickOnce(engine: Engine<any>) {
  engine.world.time.tick += 1;

  for (const sys of engine.systems) {
    sys.onTick(engine);
  }

  if (engine.world.log.length > 2000) {
    engine.world.log.splice(0, engine.world.log.length - 1000);
  }
}
