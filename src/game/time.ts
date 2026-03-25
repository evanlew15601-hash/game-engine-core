export type Phase = 'DAY' | 'NIGHT';

export function getPhase(ticksPerDay: number, tickNow: number): Phase {
  const within = tickNow % ticksPerDay;
  const half = Math.floor(ticksPerDay / 2);
  return within < half ? 'DAY' : 'NIGHT';
}

export function isDay(ticksPerDay: number, tickNow: number) {
  return getPhase(ticksPerDay, tickNow) === 'DAY';
}

export function isNight(ticksPerDay: number, tickNow: number) {
  return getPhase(ticksPerDay, tickNow) === 'NIGHT';
}
