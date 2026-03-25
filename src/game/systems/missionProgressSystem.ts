import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { worldRng } from '../../engine/sim/world';

export function missionProgressSystem(): System {
  return { onTick: runMissionProgress };
}

function runMissionProgress(engine: Engine<Defs>) {
  const { defs, world } = engine;

  for (const mission of world.missions) {
    if (mission.remainingTicks > 0) mission.remainingTicks -= 1;
    if (mission.remainingTicks > 0) continue;

    if (mission.phase === 'TRAVEL') {
      mission.phase = 'ENGAGE';
      mission.arrivalTick = world.time.tick;

      const incident = world.incidents.find((i) => i.id === mission.incidentId);
      if (incident) {
        const deadlineLateBy = Math.max(0, world.time.tick - incident.deadlineTick);
        const responseLateBy = incident.responseByTick === null ? 0 : Math.max(0, world.time.tick - incident.responseByTick);

        mission.lateByTicks = Math.max(deadlineLateBy, responseLateBy);
        if (responseLateBy > 0) incident.responseMissed = true;

        const rng = worldRng(world);
        const engageTicks = chooseEngageTicks(defs, incident.kind, rng);
        mission.remainingTicks = engageTicks;
        world.log.push({ type: 'MISSION_ENGAGE', missionId: mission.id, incidentId: mission.incidentId });
      }
      continue;
    }

    if (mission.phase === 'ENGAGE') {
      mission.phase = 'AFTERMATH';
      mission.remainingTicks = 2;
      continue;
    }

    if (mission.phase === 'AFTERMATH') {
      for (const roster of [world.rosters.HERO, world.rosters.VILLAIN, world.rosters.ROGUE]) {
        for (const a of roster) {
          if (a.status.type === 'ON_MISSION' && a.status.missionId === mission.id) {
            a.status = { type: 'AVAILABLE' };
          }
        }
      }
    }
  }

  world.missions = world.missions.filter((m) => m.phase !== 'AFTERMATH' || m.remainingTicks > 0);
}

function chooseEngageTicks(defs: Defs, kind: string, rng: ReturnType<typeof worldRng>) {
  const arch = defs.incidents.archetypes.find((a) => a.kind === kind);
  if (!arch) return 6;
  return rng.int(arch.engageTicks.min, arch.engageTicks.max);
}
