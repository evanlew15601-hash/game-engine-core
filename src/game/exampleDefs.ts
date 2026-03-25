import type { Defs } from './defs';

export function createExampleDefs(): Defs {
  return {
    rules: {
      ticksPerDay: 120,
      maxActiveIncidents: 6,
      overtimeDispatch: { costCash: 100, heatGain: 2 },
      winLose: {
        cashTarget: 5000,
        stabilityTarget: 80,
        maxHeat: 100,
        minStability: 1,
        minPublicTrust: 1,
        minUnderworldFavor: 1,
      },
    },
    company: { dailyBurn: 160 },
    subscriptions: {
      districts: ['Downtown', 'Harbor', 'Uptown', 'Industrial', 'Old City'],
      tiers: {
        NONE: { dailyFee: 0, refundPerMiss: 0, maxSlaMissesBeforePenalty: 0, satisfactionPenaltyPerExtraMiss: 0, incidentSpawnWeight: 1, slaWindowTicks: 0 },
        BASIC: { dailyFee: 130, refundPerMiss: 50, maxSlaMissesBeforePenalty: 1, satisfactionPenaltyPerExtraMiss: 5, incidentSpawnWeight: 2, slaWindowTicks: 28 },
        PREMIUM: { dailyFee: 260, refundPerMiss: 100, maxSlaMissesBeforePenalty: 0, satisfactionPenaltyPerExtraMiss: 8, incidentSpawnWeight: 3, slaWindowTicks: 18 },
      },
      emergencyCoverage: { costCash: 90, tier: 'BASIC' },
      trustPenaltyWhenDroppingCoverage: 2,
      satisfactionGainOnSuccess: 4,
      satisfactionLossOnFail: 8,
      alignment: { heroSatisfactionBonusOnSuccess: 1, villainSatisfactionPenaltyOnFail: 2 },
      demand: { min: 0.75, max: 1.6, increasePerBilling: 0.06, decreasePerBilling: 0.05, lowSatisfactionThreshold: 38, highSatisfactionThreshold: 70 },
      churn: { downgradeThreshold: 25, cancelThreshold: 12 },
      chargebackRefundThreshold: 100,
      reputationPenaltyPerChargeback: 2,
      satisfactionPenaltyOnChargeback: 10,
      heatGainOnChargeback: 4,
    },
    city: {
      stabilityLossPerFailedIncident: 6,
      stabilityGainPerSuccess: 2,
      heroOnlyTrustBonus: 2,
      villainOnlyFavorBonus: 3,
      villainOnlyHeatGain: 4,
    },
    alignment: { switchCooldownTicks: 40, switchHeatPenalty: 6, switchTrustPenalty: 5, switchUnderworldPenalty: 5 },
    roster: {
      fatiguePerMission: 8,
      fatigueRecoveryPerTick: 0.25,
      fatigueScaling: { extraPerMissionAtMaxFatigue: 6 },
      rogue: { loyaltyDecayOnSwitch: 8, refuseBaseChanceAtZeroLoyalty: 0.45, refuseMismatchBonus: 0.2 },
    },
    recruitment: { refreshTicks: 80, candidateCount: 3, minTrustToRecruitHero: 35, minFavorToRecruitVillain: 35, manualRefresh: { costCash: 150 } },
    intel: {
      tiers: {
        BASIC: { trustCost: 2, favorCost: 2, heatGain: 2, severityReduction: { min: 1, max: 2 }, deadlineExtensionTicks: { min: 4, max: 8 }, travelTicksReduction: { min: 0, max: 1 }, rogueLoyaltyCost: 5, rogueMismatchExtraLoyaltyCost: 4, minRogueLoyalty: 10 },
        STANDARD: { trustCost: 3, favorCost: 3, heatGain: 4, severityReduction: { min: 1, max: 3 }, deadlineExtensionTicks: { min: 6, max: 14 }, travelTicksReduction: { min: 1, max: 2 }, rogueLoyaltyCost: 8, rogueMismatchExtraLoyaltyCost: 6, minRogueLoyalty: 15 },
        PREMIUM: { trustCost: 5, favorCost: 5, heatGain: 8, severityReduction: { min: 2, max: 5 }, deadlineExtensionTicks: { min: 10, max: 22 }, travelTicksReduction: { min: 2, max: 4 }, rogueLoyaltyCost: 14, rogueMismatchExtraLoyaltyCost: 10, minRogueLoyalty: 25, followUp: { chance: 0.35, kind: 'Raid Opportunity', alignment: 'VILLAIN', deadlineTicks: { min: 16, max: 36 } } },
      },
    },
    incidents: {
      spawn: { baseChancePerTick: 0.04 },
      archetypes: [
        { kind: 'Bank Robbery', weight: 16, alignment: 'HERO', tags: ['HOSTAGES', 'GANG'], minSeverity: 2, maxSeverity: 6, deadlineTicks: { min: 18, max: 50 }, engageTicks: { min: 6, max: 12 } },
        { kind: 'High-Rise Fire', weight: 14, alignment: 'HERO', tags: ['FIRE', 'HOSTAGES'], minSeverity: 3, maxSeverity: 7, deadlineTicks: { min: 14, max: 40 }, engageTicks: { min: 8, max: 14 } },
        { kind: 'Armored Rampage', weight: 10, alignment: 'ANY', tags: ['ARMORED', 'TECH'], minSeverity: 4, maxSeverity: 8, deadlineTicks: { min: 16, max: 45 }, engageTicks: { min: 8, max: 14 } },
        { kind: 'Mystic Disturbance', weight: 8, alignment: 'ANY', tags: ['MYSTIC'], minSeverity: 3, maxSeverity: 9, deadlineTicks: { min: 18, max: 55 }, engageTicks: { min: 10, max: 16 } },
        { kind: 'UFO Sighting', weight: 6, alignment: 'HERO', tags: ['ALIEN', 'AERIAL'], minSeverity: 4, maxSeverity: 10, deadlineTicks: { min: 20, max: 60 }, engageTicks: { min: 10, max: 18 } },
        { kind: 'Blackmail Operation', weight: 12, alignment: 'VILLAIN', tags: ['TECH', 'HOSTAGES'], minSeverity: 3, maxSeverity: 8, deadlineTicks: { min: 16, max: 55 }, engageTicks: { min: 8, max: 16 } },
        { kind: 'Protection Racket', weight: 10, alignment: 'VILLAIN', tags: ['GANG'], minSeverity: 2, maxSeverity: 7, deadlineTicks: { min: 18, max: 60 }, engageTicks: { min: 6, max: 14 } },
      ],
    },
    tactics: {
      STEALTH: { scoreMultiplier: 0.9, collateralMultiplier: 0.5, injuryMultiplier: 1.1 },
      CONTROL: { scoreMultiplier: 1.0, collateralMultiplier: 0.8, injuryMultiplier: 1.0 },
      BRUTE: { scoreMultiplier: 1.15, collateralMultiplier: 1.4, injuryMultiplier: 0.9 },
    },
    tagCounters: {
      FIRE: [{ tag: 'TECH', bonus: 6 }],
      ARMORED: [{ tag: 'TECH', bonus: 6 }],
      MYSTIC: [{ tag: 'MYSTIC', bonus: 10 }],
      AERIAL: [{ tag: 'AERIAL', bonus: 8 }],
      ALIEN: [{ tag: 'TECH', bonus: 4 }, { tag: 'MYSTIC', bonus: 4 }],
      TECH: [{ tag: 'TECH', bonus: 8 }],
    },
  };
}
