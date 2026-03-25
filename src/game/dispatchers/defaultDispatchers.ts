import type { Dispatcher } from '../../engine/runtime/dispatcher';
import type { FeatureToggles } from '../features';
import { createDefaultFeatures } from '../features';
import { alignmentDispatcher } from './alignmentDispatcher';
import { coverageDispatcher } from './coverageDispatcher';
import { intelDispatcher } from './intelDispatcher';
import { emergencyCoverageDispatcher } from './emergencyCoverageDispatcher';
import { missionDispatchDispatcher } from './missionDispatchDispatcher';
import { recruitmentDispatcher } from './recruitmentDispatcher';
import { isCommand } from './guards';

export function createDefaultDispatchers(features: FeatureToggles = createDefaultFeatures()): Dispatcher[] {
  const dispatchers = [
    features.dispatchers.alignment ? alignmentDispatcher() : null,
    features.dispatchers.missionDispatch ? missionDispatchDispatcher() : null,
    features.dispatchers.recruitment ? recruitmentDispatcher() : null,
    features.dispatchers.intel ? intelDispatcher() : null,
    features.dispatchers.coverage ? coverageDispatcher() : null,
    features.dispatchers.coverage ? emergencyCoverageDispatcher() : null,
  ].filter((x): x is Dispatcher => Boolean(x));

  return [
    {
      dispatch: (engine, cmd) => {
        if (!isCommand(cmd)) return false;
        for (const d of dispatchers) {
          if (d.dispatch(engine, cmd)) return true;
        }
        return false;
      },
    },
  ];
}
