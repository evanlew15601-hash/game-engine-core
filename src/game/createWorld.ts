import type { Alignment } from '../engine/defs/defs';
import type { World } from '../engine/sim/world';
import type { Defs } from './defs';

export function createWorld(params: {
  defs: Defs;
  seed: number;
  startingAlignment: Alignment;
}): World {
  return {
    time: { tick: 0 },
    meta: { nextId: 1 },
    rng: { seed: params.seed, state: params.seed },
    player: {
      alignment: params.startingAlignment,
      lastSwitchTick: -params.defs.alignment.switchCooldownTicks,
    },
    city: { stability: 70, publicTrust: 55, underworldFavor: 40, heat: 20 },
    rosters: { HERO: [], VILLAIN: [], ROGUE: [] },
    game: { state: 'RUNNING', reason: '', endedTick: null },
    company: { cash: 500 },
    subscriptions: {
      districts: Object.fromEntries(
        params.defs.subscriptions.districts.map((d) => [
          d,
          {
            tier: 'NONE' as const,
            satisfaction: 55,
            demand: 1,
            slaMissesThisPeriod: 0,
            lastPeriod: { billed: 0, refund: 0, misses: 0, hadChargeback: false },
          },
        ]),
      ),
      nextBillingTick: params.defs.rules.ticksPerDay,
      lastBilledTick: 0,
      lastTotals: { billed: 0, refunds: 0, chargebacks: 0, net: 0, operatingCost: 0 },
    },
    recruitment: {
      nextRefreshTick: 0,
      candidates: [],
      manualRefresh: { nextAllowedTick: 0 },
    },
    incidents: [],
    missions: [],
    log: [],
  };
}
