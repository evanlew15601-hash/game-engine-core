import type { Alignment, CoverageTier, IntelTier, Morality, Tag, Tactic } from '../defs/defs';
import type { Rng } from '../rng/rng';

export type World = {
  time: {
    tick: number;
  };
  meta: {
    nextId: number;
  };
  rng: {
    seed: number;
    state: number;
  };
  player: {
    alignment: Alignment;
    lastSwitchTick: number;
  };
  city: {
    stability: number;
    publicTrust: number;
    underworldFavor: number;
    heat: number;
  };
  rosters: {
    HERO: Agent[];
    VILLAIN: Agent[];
    ROGUE: Agent[];
  };
  game: {
    state: 'RUNNING' | 'WON' | 'LOST';
    reason: string;
    endedTick: number | null;
  };
  company: {
    cash: number;
  };
  subscriptions: {
    districts: Record<
      string,
      {
        tier: CoverageTier;
        emergency?: {
          prevTier: CoverageTier;
          expiresTick: number;
        };
        satisfaction: number;
        demand: number;
        slaMissesThisPeriod: number;
        lastPeriod: {
          billed: number;
          refund: number;
          misses: number;
          hadChargeback: boolean;
        };
      }
    >;
    nextBillingTick: number;
    lastBilledTick: number;
    lastTotals: {
      billed: number;
      refunds: number;
      chargebacks: number;
      net: number;
      operatingCost: number;
    };
  };
  recruitment: {
    nextRefreshTick: number;
    candidates: RecruitCandidate[];
    manualRefresh: {
      nextAllowedTick: number;
    };
  };
  incidents: Incident[];
  missions: Mission[];
  log: SimEvent[];
};

export type RosterKey = 'HERO' | 'VILLAIN' | 'ROGUE';

export type Agent = {
  id: string;
  name: string;
  morality: Morality;
  power: number;
  tags: Tag[];
  status:
    | { type: 'AVAILABLE' }
    | { type: 'ON_MISSION'; missionId: string }
    | { type: 'INJURED'; untilTick: number };
  fatigue: number;
  loyalty: number;
  preferredAlignment: Alignment;
};

export type RecruitCandidate = {
  id: string;
  name: string;
  morality: 'HERO' | 'VILLAIN' | 'ROGUE';
  power: number;
  tags: Tag[];
  loyalty: number;
  preferredAlignment: Alignment;
};

export type Incident = {
  id: string;
  kind: string;
  district: string;
  tags: Tag[];
  severity: number;
  createdTick: number;
  deadlineTick: number;
  responseByTick: number | null;
  slaTier: CoverageTier;
  responseMissed: boolean;
  intelTravelBonusTicks: number;
  state: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'FAILED';
  alignment: 'ANY' | Alignment;
};

export type Mission = {
  id: string;
  incidentId: string;
  agentIds: string[];
  tactic: Tactic;
  phase: 'TRAVEL' | 'ENGAGE' | 'AFTERMATH';
  remainingTicks: number;
  departTick: number;
  arrivalTick: number | null;
  lateByTicks: number;
};

export type SimEvent =
  | { type: 'INCIDENT_SPAWNED'; incidentId: string; kind: string; district: string; tags: Tag[]; severity: number; deadlineTick: number }
  | { type: 'DISPATCHED'; missionId: string; incidentId: string; agentIds: string[]; tactic: Tactic }
  | { type: 'MISSION_ENGAGE'; missionId: string; incidentId: string }
  | { type: 'MISSION_RESOLVED'; missionId: string; incidentId: string; outcome: 'FAIL' | 'PARTIAL' | 'SUCCESS' | 'CLEAN'; collateral: number; injuries: number }
  | { type: 'INCIDENT_RESPONSE_MISSED'; incidentId: string; district: string; tier: CoverageTier }
  | { type: 'INCIDENT_FAILED'; incidentId: string }
  | { type: 'ALIGNMENT_SWITCHED'; alignment: Alignment }
  | { type: 'RECRUIT_POOL_REFRESHED'; candidateIds: string[] }
  | { type: 'RECRUITED'; agentId: string; morality: Morality }
  | { type: 'INTEL_BOUGHT'; incidentId: string; rogueId: string; tier: IntelTier; severityDelta: number; deadlineDelta: number; travelBonusTicks: number }
  | { type: 'FOLLOWUP_SPAWNED'; incidentId: string; kind: string; alignment: Alignment }
  | { type: 'COVERAGE_SET'; district: string; tier: CoverageTier }
  | { type: 'OPERATING_COST'; amount: number }
  | { type: 'BILLED_SUBSCRIPTIONS'; amount: number }
  | { type: 'REFUND_ISSUED'; district: string; amount: number; misses: number }
  | { type: 'CHARGEBACK'; district: string; amount: number; affects: 'PUBLIC_TRUST' | 'UNDERWORLD_FAVOR'; penalty: number }
  | { type: 'GAME_ENDED'; state: 'WON' | 'LOST'; reason: string };

export function worldRng(world: World): Rng {
  let state = world.rng.state >>> 0;

  const nextU32 = () => {
    state += 0x6d2b79f5;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    const out = (x ^ (x >>> 14)) >>> 0;
    world.rng.state = state;
    return out;
  };

  return {
    seed: world.rng.seed,
    nextU32,
    nextFloat01: () => nextU32() / 4294967296,
    int: (minInclusive, maxInclusive) => {
      const span = maxInclusive - minInclusive + 1;
      return minInclusive + (nextU32() % span);
    },
  };
}

export function allocId(world: World, prefix: string) {
  const id = `${prefix}_${world.meta.nextId}`;
  world.meta.nextId += 1;
  return id;
}
