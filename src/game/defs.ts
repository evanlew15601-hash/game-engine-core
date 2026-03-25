import type { Alignment, CoverageTier, IntelTier, Tag, Tactic } from '../engine/defs/defs';

export type Defs = {
  rules: {
    ticksPerDay: number;
    maxActiveIncidents: number;
    overtimeDispatch: {
      costCash: number;
      heatGain: number;
    };
    winLose: {
      cashTarget: number;
      stabilityTarget: number;
      maxHeat: number;
      minStability: number;
      minPublicTrust: number;
      minUnderworldFavor: number;
    };
  };
  company: {
    dailyBurn: number;
  };
  subscriptions: {
    districts: string[];
    tiers: Record<
      CoverageTier,
      {
        dailyFee: number;
        refundPerMiss: number;
        maxSlaMissesBeforePenalty: number;
        satisfactionPenaltyPerExtraMiss: number;
        incidentSpawnWeight: number;
        slaWindowTicks: number;
      }
    >;
    emergencyCoverage: {
      costCash: number;
      tier: CoverageTier;
    };
    trustPenaltyWhenDroppingCoverage: number;
    satisfactionGainOnSuccess: number;
    satisfactionLossOnFail: number;
    alignment: {
      heroSatisfactionBonusOnSuccess: number;
      villainSatisfactionPenaltyOnFail: number;
    };
    demand: {
      min: number;
      max: number;
      increasePerBilling: number;
      decreasePerBilling: number;
      lowSatisfactionThreshold: number;
      highSatisfactionThreshold: number;
    };
    churn: {
      downgradeThreshold: number;
      cancelThreshold: number;
    };
    chargebackRefundThreshold: number;
    reputationPenaltyPerChargeback: number;
    satisfactionPenaltyOnChargeback: number;
    heatGainOnChargeback: number;
  };
  city: {
    stabilityLossPerFailedIncident: number;
    stabilityGainPerSuccess: number;
    heroOnlyTrustBonus: number;
    villainOnlyFavorBonus: number;
    villainOnlyHeatGain: number;
  };
  alignment: {
    switchCooldownTicks: number;
    switchHeatPenalty: number;
    switchTrustPenalty: number;
    switchUnderworldPenalty: number;
  };
  roster: {
    fatiguePerMission: number;
    fatigueRecoveryPerTick: number;
    fatigueScaling: {
      extraPerMissionAtMaxFatigue: number;
    };
    rogue: {
      loyaltyDecayOnSwitch: number;
      refuseBaseChanceAtZeroLoyalty: number;
      refuseMismatchBonus: number;
    };
  };
  recruitment: {
    refreshTicks: number;
    candidateCount: number;
    minTrustToRecruitHero: number;
    minFavorToRecruitVillain: number;
    manualRefresh: {
      costCash: number;
    };
  };
  intel: {
    tiers: Record<
      IntelTier,
      {
        trustCost: number;
        favorCost: number;
        heatGain: number;
        severityReduction: { min: number; max: number };
        deadlineExtensionTicks: { min: number; max: number };
        travelTicksReduction: { min: number; max: number };
        rogueLoyaltyCost: number;
        rogueMismatchExtraLoyaltyCost: number;
        minRogueLoyalty: number;
        followUp?: {
          chance: number;
          kind: string;
          alignment: Alignment;
          deadlineTicks: { min: number; max: number };
        };
      }
    >;
  };
  incidents: {
    spawn: {
      baseChancePerTick: number;
    };
    archetypes: Array<{
      kind: string;
      weight: number;
      alignment: 'ANY' | Alignment;
      tags: Tag[];
      minSeverity: number;
      maxSeverity: number;
      deadlineTicks: { min: number; max: number };
      engageTicks: { min: number; max: number };
    }>;
  };
  tactics: Record<
    Tactic,
    {
      scoreMultiplier: number;
      collateralMultiplier: number;
      injuryMultiplier: number;
    }
  >;
  tagCounters: Partial<Record<Tag, Array<{ tag: Tag; bonus: number }>>>;
};
