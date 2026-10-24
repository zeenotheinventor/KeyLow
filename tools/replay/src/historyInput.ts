import { profileBmr, startSnapshot } from "@keylow/core/engine";

import type { History } from "./historySchema.ts";
import type { ReplayInput } from "./replay.ts";

/**
 * The replay input of a history file. The start snapshot is `startSnapshot` for the stats at the onboarding
 * weight, as of `startedOn`, and each check-in's BMR is `profileBmr` on its own day.
 */
export function historyToInput({
  stats,
  onboardingWeightKg,
  program: { startedOn, ...program },
  weighIns,
  days,
}: History): ReplayInput {
  return {
    startedOn,
    program,
    weighIns,
    days: days.map(({ localDate, kcal, isComplete }) => ({
      localDate,
      intakeKcal: kcal,
      isComplete,
    })),
    onboardingWeightKg,
    start: (params) => {
      const snapshot = startSnapshot(
        { stats, onboardingWeightKg, asOfDate: startedOn, trendWeightKg: null },
        params,
      );
      return {
        prior: { muKcal: snapshot.mu_kcal, varKcal2: snapshot.var_kcal2 },
        bmrKcalOn: (asOfDate) => profileBmr(stats, onboardingWeightKg, asOfDate, params),
      };
    },
  };
}
