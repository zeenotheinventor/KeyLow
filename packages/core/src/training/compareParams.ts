import { TRAINING_PARAMS_V2, TRAINING_PARAMS_VERSION_V2 } from "./params";

import type { TrainingParams } from "./params";

/*
 * The tunables of projected against actual (ADR 0005, "Projected against actual"). They sit beside
 * `TrainingParams` rather than inside it because `TRAINING_PARAMS_V2` is pinned field by field by its
 * own test, so adding a field there would edit the v2 object in place, which the versioning rule of
 * ADR 0002 forbids. Both objects carry the same version, and this one holds the training params it was
 * tuned with, so the whole plan view runs on one object and one version.
 */

export type CompareParams = Readonly<{
  version: typeof TRAINING_PARAMS_VERSION_V2;
  /** The heat and volume numbers the planned and logged sets are counted with. */
  training: TrainingParams;
  /**
   * The local time a planned day's sets are placed at, on its weekday, in the week's zone. A routine
   * day has no time of its own, so every planned set of a day lands at this one moment. It is where a
   * counted planned set decays from, not when it starts to count: projected heat counts a planned set
   * from the day after (`projectedState`).
   */
  plannedTime: Readonly<{ hour: number; minute: number }>;
  /**
   * How far, in effort-weighted sets, actual may sit from projected and still be on plan. A gap of
   * exactly the tolerance is on plan.
   */
  onPlanToleranceSets: number;
}>;

/**
 * The values under `keylow-training-v2`, the plan tunables as they were in v1: planned days at 18:00 local,
 * on plan within 1 set.
 */
export const COMPARE_PARAMS_V2: CompareParams = {
  version: TRAINING_PARAMS_VERSION_V2,
  training: TRAINING_PARAMS_V2,
  plannedTime: { hour: 18, minute: 0 },
  onPlanToleranceSets: 1,
};
