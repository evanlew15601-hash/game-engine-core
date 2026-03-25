import type { Alignment, CoverageTier, IntelTier, Tactic } from '../engine/defs/defs';

export type Command =
  | { type: 'SET_ALIGNMENT'; alignment: Alignment }
  | { type: 'DISPATCH_TEAM'; incidentId: string; agentIds: string[]; tactic: Tactic; overtime?: boolean }
  | { type: 'RECRUIT'; candidateId: string }
  | { type: 'REFRESH_RECRUITMENT' }
  | { type: 'BUY_INTEL'; incidentId: string; rogueId: string; tier: IntelTier }
  | { type: 'SET_COVERAGE'; district: string; tier: CoverageTier }
  | { type: 'BUY_EMERGENCY_COVERAGE'; district: string };
