import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { isDay } from '../time';
import { clamp01to100 } from './utils';

export function subscriptionBillingSystem(): System {
  return { onTick: runBilling };
}

function runBilling(engine: Engine<Defs>) {
  const { defs, world } = engine;

  if (world.time.tick < world.subscriptions.nextBillingTick) return;
  if (!isDay(defs.rules.ticksPerDay, world.time.tick)) return;
  if (world.time.tick % defs.rules.ticksPerDay !== 0) return;

  world.subscriptions.lastBilledTick = world.subscriptions.nextBillingTick;
  world.subscriptions.nextBillingTick += defs.rules.ticksPerDay;

  let billed = 0;
  let refunds = 0;
  let chargebacks = 0;

  for (const [district, sub] of Object.entries(world.subscriptions.districts)) {
    const tier = defs.subscriptions.tiers[sub.tier];
    const misses = sub.slaMissesThisPeriod;
    const refund = misses * tier.refundPerMiss;
    const net = Math.max(0, tier.dailyFee - refund);

    billed += tier.dailyFee;
    refunds += refund;

    let hadChargeback = false;

    if (refund > 0) {
      world.log.push({ type: 'REFUND_ISSUED', district, amount: refund, misses });

      if (refund >= defs.subscriptions.chargebackRefundThreshold) {
        hadChargeback = true;
        chargebacks += 1;

        const penalty = defs.subscriptions.reputationPenaltyPerChargeback;

        if (world.player.alignment === 'HERO') {
          world.city.publicTrust = clamp01to100(world.city.publicTrust - penalty);
        } else {
          world.city.underworldFavor = clamp01to100(world.city.underworldFavor - penalty);
        }

        sub.satisfaction = clamp01to100(sub.satisfaction - defs.subscriptions.satisfactionPenaltyOnChargeback);
        world.city.heat = clamp01to100(world.city.heat + defs.subscriptions.heatGainOnChargeback);

        world.log.push({
          type: 'CHARGEBACK',
          district,
          amount: refund,
          affects: world.player.alignment === 'HERO' ? 'PUBLIC_TRUST' : 'UNDERWORLD_FAVOR',
          penalty,
        });
      }
    }

    const extraMisses = Math.max(0, misses - tier.maxSlaMissesBeforePenalty);
    if (extraMisses > 0) {
      sub.satisfaction = clamp01to100(sub.satisfaction - extraMisses * tier.satisfactionPenaltyPerExtraMiss);
    }

    sub.lastPeriod = { billed: tier.dailyFee, refund, misses, hadChargeback };
    sub.slaMissesThisPeriod = 0;
    world.company.cash += net;
  }

  const operatingCost = defs.company.dailyBurn;
  world.company.cash -= operatingCost;
  world.log.push({ type: 'OPERATING_COST', amount: operatingCost });

  world.subscriptions.lastTotals = {
    billed,
    refunds,
    chargebacks,
    net: billed - refunds - operatingCost,
    operatingCost,
  };

  world.log.push({ type: 'BILLED_SUBSCRIPTIONS', amount: billed - refunds });
}
