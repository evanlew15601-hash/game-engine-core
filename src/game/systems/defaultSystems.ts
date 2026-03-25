import type { System } from '../../engine/runtime/system';
import type { FeatureToggles } from '../features';
import { createDefaultFeatures } from '../features';
import { incidentDeadlineSystem } from './incidentDeadlineSystem';
import { incidentResponseWindowSystem } from './incidentResponseWindowSystem';
import { incidentSpawnSystem } from './incidentSpawnSystem';
import { missionProgressSystem } from './missionProgressSystem';
import { missionResolutionSystem } from './missionResolutionSystem';
import { recoverySystem } from './recoverySystem';
import { recruitmentMarketSystem } from './recruitmentMarketSystem';
import { recruitmentRefreshSystem } from './recruitmentRefreshSystem';
import { subscriptionBillingSystem } from './subscriptionBillingSystem';
import { subscriptionClientHealthSystem } from './subscriptionClientHealthSystem';
import { subscriptionDemandSystem } from './subscriptionDemandSystem';
import { gameStatusSystem } from './gameStatusSystem';
import { emergencyCoverageExpirySystem } from './emergencyCoverageExpirySystem';

export function createDefaultSystems(features: FeatureToggles = createDefaultFeatures()): Array<System> {
  return [
    features.systems.subscriptionBilling ? subscriptionBillingSystem() : null,
    features.systems.subscriptionClientHealth ? subscriptionClientHealthSystem() : null,
    features.systems.subscriptionClientHealth ? subscriptionDemandSystem() : null,
    features.systems.subscriptionBilling ? emergencyCoverageExpirySystem() : null,
    features.systems.recruitmentRefresh ? recruitmentRefreshSystem() : null,
    features.systems.recruitmentMarket ? recruitmentMarketSystem() : null,
    features.systems.recovery ? recoverySystem() : null,
    features.systems.missionProgress ? missionProgressSystem() : null,
    features.systems.missionResolution ? missionResolutionSystem() : null,
    features.systems.incidentDeadlines ? incidentResponseWindowSystem() : null,
    features.systems.incidentDeadlines ? incidentDeadlineSystem() : null,
    features.systems.incidentSpawns ? incidentSpawnSystem() : null,
    features.systems.gameStatus ? gameStatusSystem() : null,
  ].filter((x): x is System => Boolean(x));
}
