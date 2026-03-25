import type { Engine } from '../../engine/runtime/engine';
import type { System } from '../../engine/runtime/system';
import type { Defs } from '../defs';
import { clamp01to100 } from './utils';

export function incidentResponseWindowSystem(): System {
  return { onTick: runIncidentResponseWindows };
}

function runIncidentResponseWindows(engine: Engine<Defs>) {
  const { defs, world } = engine;

  for (const incident of world.incidents) {
    if (incident.state !== 'OPEN') continue;
    if (incident.slaTier === 'NONE') continue;
    if (incident.responseByTick === null) continue;
    if (incident.responseMissed) continue;

    if (world.time.tick <= incident.responseByTick) continue;

    incident.responseMissed = true;

    const sub = world.subscriptions.districts[incident.district];
    if (sub) {
      sub.slaMissesThisPeriod += 1;
      sub.satisfaction = clamp01to100(sub.satisfaction - Math.ceil(defs.subscriptions.satisfactionLossOnFail / 2));
    }

    world.log.push({ type: 'INCIDENT_RESPONSE_MISSED', incidentId: incident.id, district: incident.district, tier: incident.slaTier });
  }
}
