import type { Alignment, Morality, Tag } from '../engine/defs/defs';
import type { Defs } from './defs';
import { createWorld } from './createWorld';

export function createExampleScenario(params: { defs: Defs; seed: number }) {
  const world = createWorld({ defs: params.defs, seed: params.seed, startingAlignment: 'HERO' });

  world.rosters.HERO = [
    agent('hero_1', 'Aegis', 'HERO', 34, ['ARMORED', 'TECH'], 100, 'HERO'),
    agent('hero_2', 'Cinder', 'HERO', 28, ['FIRE'], 100, 'HERO'),
    agent('hero_3', 'Shade', 'HERO', 26, ['HOSTAGES'], 100, 'HERO'),
    agent('hero_4', 'Oracle Knot', 'HERO', 30, ['MYSTIC'], 100, 'HERO'),
  ];

  world.rosters.VILLAIN = [
    agent('vil_1', 'Wraithline', 'VILLAIN', 36, ['AERIAL', 'TECH'], 100, 'VILLAIN'),
    agent('vil_2', 'Grindhouse', 'VILLAIN', 32, ['ARMORED'], 100, 'VILLAIN'),
    agent('vil_3', 'Null Siren', 'VILLAIN', 27, ['MYSTIC', 'HOSTAGES'], 100, 'VILLAIN'),
  ];

  world.rosters.ROGUE = [
    agent('rog_1', 'Sidelock', 'ROGUE', 29, ['TECH'], 70, 'HERO'),
    agent('rog_2', 'Glass Viper', 'ROGUE', 33, ['AERIAL'], 55, 'VILLAIN'),
  ];

  return world;
}

function agent(id: string, name: string, morality: Morality, power: number, tags: Tag[], loyalty: number, preferredAlignment: Alignment) {
  return {
    id,
    name,
    morality,
    power,
    tags,
    status: { type: 'AVAILABLE' } as const,
    fatigue: 0,
    loyalty,
    preferredAlignment,
  };
}
