export type FeatureToggles = {
  systems: {
    subscriptionBilling: boolean;
    subscriptionClientHealth: boolean;
    recruitmentRefresh: boolean;
    recruitmentMarket: boolean;
    recovery: boolean;
    missionProgress: boolean;
    missionResolution: boolean;
    incidentDeadlines: boolean;
    incidentSpawns: boolean;
    gameStatus: boolean;
  };
  dispatchers: {
    alignment: boolean;
    missionDispatch: boolean;
    recruitment: boolean;
    intel: boolean;
    coverage: boolean;
  };
};

export function createDefaultFeatures(): FeatureToggles {
  return {
    systems: {
      subscriptionBilling: true,
      subscriptionClientHealth: true,
      recruitmentRefresh: true,
      recruitmentMarket: true,
      recovery: true,
      missionProgress: true,
      missionResolution: true,
      incidentDeadlines: true,
      incidentSpawns: true,
      gameStatus: true,
    },
    dispatchers: {
      alignment: true,
      missionDispatch: true,
      recruitment: true,
      intel: true,
      coverage: true,
    },
  };
}
