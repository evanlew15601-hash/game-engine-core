import type { Tag } from '../../engine/defs/defs';
import type { Defs } from '../defs';

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n));
}

export function pickTags(rng: { int: (minInclusive: number, maxInclusive: number) => number }, morality: 'HERO' | 'VILLAIN' | 'ROGUE') {
  const common: Tag[] = ['TECH', 'ARMORED', 'MYSTIC', 'AERIAL', 'HOSTAGES', 'FIRE'];
  const pool = morality === 'HERO' ? common : morality === 'VILLAIN' ? [...common, 'GANG'] : [...common, 'ALIEN'];

  const count = rng.int(1, 2);
  const tags: Tag[] = [];
  while (tags.length < count) {
    const t: Tag = pool[rng.int(0, pool.length - 1)];
    if (!tags.includes(t)) tags.push(t);
  }

  return tags;
}

export function computeCoverageBonus(defs: Defs, incidentTags: Tag[], team: Array<{ tags: Tag[] }>) {
  let bonus = 0;
  const teamTags = new Set<Tag>();
  for (const a of team) for (const t of a.tags) teamTags.add(t);

  for (const t of incidentTags) {
    const counters = defs.tagCounters[t] ?? [];
    for (const c of counters) {
      if (teamTags.has(c.tag)) bonus += c.bonus;
    }
  }

  return bonus;
}
