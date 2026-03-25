import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';

export function gameStatusSystem(): System {
  return { onTick: runGameStatus };
}

function runGameStatus(engine: Engine<Defs>) {
  const { defs, world } = engine;
  if (world.game.state !== 'RUNNING') return;

  const rules = defs.rules.winLose;

  if (world.company.cash < 0) { endGame(world, 'LOST', 'Bankrupt'); return; }
  if (world.city.heat >= rules.maxHeat) { endGame(world, 'LOST', 'Heat maxed out (crackdown)'); return; }
  if (world.city.stability < rules.minStability) { endGame(world, 'LOST', 'City collapsed'); return; }
  if (world.player.alignment === 'HERO' && world.city.publicTrust < rules.minPublicTrust) { endGame(world, 'LOST', 'Public trust collapsed'); return; }
  if (world.player.alignment === 'VILLAIN' && world.city.underworldFavor < rules.minUnderworldFavor) { endGame(world, 'LOST', 'Underworld favor collapsed'); return; }

  if (world.company.cash >= rules.cashTarget && world.city.stability >= rules.stabilityTarget) {
    endGame(world, 'WON', 'Dominated the market');
  }
}

function endGame(world: Engine<Defs>['world'], state: 'WON' | 'LOST', reason: string) {
  world.game.state = state;
  world.game.reason = reason;
  world.game.endedTick = world.time.tick;
  world.log.push({ type: 'GAME_ENDED', state, reason });
}
