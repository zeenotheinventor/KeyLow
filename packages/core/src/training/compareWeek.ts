import { MUSCLE_IDS } from "./muscles";
import { weightedSetsByMuscle } from "./muscleState";

import type { CompareParams } from "./compareParams";
import type { MuscleId } from "./muscles";
import type { HeatSet } from "./muscleState";

/** Where a muscle's actual week sits against its projected week. */
export const PLAN_STATUSES = ["behind", "on_plan", "ahead"] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

export type MusclePlanComparison = {
  /** Effort-weighted sets logged in the week. */
  actualWeeklySets: number;
  /** Effort-weighted sets of the projection: the plan, with logged days in place of planned ones. */
  projectedWeeklySets: number;
  /** Actual minus projected: below 0 when behind the plan, above 0 when ahead of it. */
  gap: number;
  status: PlanStatus;
};

// The gap is rounded as weekly sets are, so floating point drift never moves a status across the tolerance.
const GAP_SCALE = 1e9;

const statusOf = (gap: number, tolerance: number): PlanStatus => {
  if (gap < -tolerance) {
    return "behind";
  }
  return gap > tolerance ? "ahead" : "on_plan";
};

/**
 * Per muscle, the actual and projected effort-weighted sets of one week, the gap between them and
 * whether actual is `behind`, `on_plan` or `ahead`. On plan means within `params.onPlanToleranceSets`
 * (1 set in v1) either way, the tolerance itself included.
 *
 * Every live set given counts, whenever it was performed, so pass one week's sets: `projectWeek` gives
 * both lists for a calendar week. A set counts `weight × effort` on each muscle of its snapshot, as in
 * `weeklyVolume`. Every muscle id is present, at 0 and on plan when neither list trains it.
 *
 * Throws a `RangeError` naming the rule when a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const compareWeek = (
  actual: readonly HeatSet[],
  projected: readonly HeatSet[],
  params: CompareParams,
): Record<MuscleId, MusclePlanComparison> => {
  const actualSets = weightedSetsByMuscle(actual, params.training);
  const projectedSets = weightedSetsByMuscle(projected, params.training);
  // Every id of the list is mapped, so the entries make the full record.
  return Object.fromEntries(
    MUSCLE_IDS.map((muscle) => {
      const actualWeeklySets = actualSets[muscle];
      const projectedWeeklySets = projectedSets[muscle];
      // Adding 0 turns a rounded −0 into 0, so an exact match reads as a gap of 0.
      const gap = Math.round((actualWeeklySets - projectedWeeklySets) * GAP_SCALE) / GAP_SCALE + 0;
      return [
        muscle,
        {
          actualWeeklySets,
          projectedWeeklySets,
          gap,
          status: statusOf(gap, params.onPlanToleranceSets),
        },
      ];
    }),
  ) as Record<MuscleId, MusclePlanComparison>;
};
