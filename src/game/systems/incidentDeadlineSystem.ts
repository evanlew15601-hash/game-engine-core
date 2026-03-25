import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { clamp01to100 } from './utils';

export function incidentDeadlineSystem(): System {
  return { onTick: runIncidentDeadlines };
}

function runIncidentDeadlines(engine: Engine<Defs>) {
  const { defs, world } = engine;

  for (const incident of world.incidents) {
    if (incident.state !== 'OPEN') continue;
    if (world.time.tick <= incident.deadlineTick) continue;

    incident.state = 'FAILED';
    world.city.stability = clamp01to100(world.city.stability - defs.city.stabilityLossPerFailedIncident);

    const sub = world.subscriptions.districts[incident.district];
    if (sub && incident.slaTier !== 'NONE') {
      if (!incident.responseMissed) sub.slaMissesThisPeriod += 1;
      incident.responseMissed = true;
      sub.satisfaction = clamp01to100(sub.satisfaction - defs.subscriptions.satisfactionLossOnFail);
    }

    world.log.push({ type: 'INCIDENT_FAILED', incidentId: incident.id });
  }
}
