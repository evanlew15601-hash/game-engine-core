export type Alignment = 'HERO' | 'VILLAIN';

export type Morality = 'HERO' | 'VILLAIN' | 'ROGUE';

export type Tactic = 'STEALTH' | 'CONTROL' | 'BRUTE';

export type IntelTier = 'BASIC' | 'STANDARD' | 'PREMIUM';

export type Tag =
  | 'HOSTAGES'
  | 'FIRE'
  | 'MYSTIC'
  | 'ARMORED'
  | 'AERIAL'
  | 'GANG'
  | 'ALIEN'
  | 'TECH';

export type CoverageTier = 'NONE' | 'BASIC' | 'PREMIUM';

// NOTE: game-specific defs intentionally live in `src/game/defs.ts`.
// Engine-level defs are reserved for future engine-wide tuning knobs.
export type Defs = Record<string, never>;
