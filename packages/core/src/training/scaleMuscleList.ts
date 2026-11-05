import { GAP_VALUES } from "./bodyMapValues";
import { MUSCLE_IDS } from "./muscles";
import { muscleParams, VOLUME_STATUSES, volumeStatusOf } from "./muscleState";
import { TRAINING_PARAMS_V2 } from "./params";

import type { BodyMapView } from "./bodyMapValues";
import type { MusclePlanComparison } from "./compareWeek";
import type { MuscleId } from "./muscles";
import type { VolumeStatus } from "./muscleState";
import type { TrainingParams } from "./params";

/*
 * The rows of the web Muscles card on Volume and Gap (`web-body · volume`, `web-body · gap`): which muscles
 * the card lists, in what order, and how many it leaves out. Pure under the ADR 0002 rule. The screen writes
 * the sentences from these fields, so no counting or sorting lives in it.
 */

const HUNDREDTHS = 100;

// Sets are compared as they are written (to two decimals), so floating point drift never breaks a tie.
const hundredthsOf = (sets: number): number => Math.round(sets * HUNDREDTHS);

const GROWING_INDEX = VOLUME_STATUSES.indexOf("growing");

const reachesGrowing = (status: VolumeStatus): boolean =>
  VOLUME_STATUSES.indexOf(status) >= GROWING_INDEX;

export type VolumeMuscleRow = {
  muscle: MuscleId;
  /** The week's sets: the projected ones in Projected, the logged ones in Actual. */
  weeklySets: number;
  status: VolumeStatus;
};

export type MusclesByVolume = {
  scale: "volume";
  /** The muscles at Growing or above, most sets first. Muscles with the same sets keep the order of the list. */
  rows: VolumeMuscleRow[];
  /** How many muscles the rows leave out because they are still at Maintaining. */
  moreMaintaining: number;
  /** How many muscles the rows leave out because they are Not trained. */
  notTrained: number;
};

/**
 * The muscles of the Volume card: those at Growing or above for the view, most sets first, with how many are
 * left out as Maintaining and as Not trained. `comparison` is the week's `compareWeek`, and with no routine
 * the caller asks for "actual", since there is no plan to project.
 */
export const musclesByVolume = (
  comparison: Readonly<
    Record<MuscleId, Pick<MusclePlanComparison, "actualWeeklySets" | "projectedWeeklySets">>
  >,
  view: BodyMapView,
  params: TrainingParams = TRAINING_PARAMS_V2,
): MusclesByVolume => {
  const all: VolumeMuscleRow[] = MUSCLE_IDS.map((muscle) => {
    const { actualWeeklySets, projectedWeeklySets } = comparison[muscle];
    const weeklySets = view === "actual" ? actualWeeklySets : projectedWeeklySets;
    return {
      muscle,
      weeklySets,
      status: volumeStatusOf(weeklySets, muscleParams(muscle, params).volume),
    };
  });
  return {
    scale: "volume",
    // The sort is stable, so equal sets keep the order of the muscle list.
    rows: all
      .filter(({ status }) => reachesGrowing(status))
      .sort((a, b) => hundredthsOf(b.weeklySets) - hundredthsOf(a.weeklySets)),
    moreMaintaining: all.filter(({ status }) => status === "maintaining").length,
    notTrained: all.filter(({ status }) => status === "not_trained").length,
  };
};

export type GapMuscleRow = {
  muscle: MuscleId;
  /** Effort-weighted sets done so far this week. */
  done: number;
  /** Effort-weighted sets of the week's plan so far. */
  planned: number;
  status: "behind" | "on_plan" | "ahead";
};

export type MusclesAgainstPlan = {
  scale: "gap";
  /** The muscles in the plan, furthest behind first. */
  rows: GapMuscleRow[];
  /** How many muscles on plan the rows leave out because their plan is under Growing. */
  moreOnPlan: number;
  /** How many muscles the plan does not hold. */
  notInPlan: number;
};

const NOT_IN_PLAN_INDEX = GAP_VALUES.indexOf("not_in_plan");

/**
 * The muscles of the Gap card: every muscle in the plan that is behind or ahead of it, and those on plan whose
 * planned sets reach Growing, furthest behind first. Muscles with the same gap go the one with the bigger plan
 * first, then in the order of the list. A muscle that is not in the plan is never a row, so it can never read as
 * behind. `comparison` is the plan so far (`compareWeekSoFar`) and `values` is `gapValues`, which tells whether a
 * muscle is in the plan from the whole week.
 */
export const musclesAgainstPlan = (
  comparison: Readonly<Record<MuscleId, MusclePlanComparison>>,
  values: Readonly<Record<MuscleId, number>>,
  params: TrainingParams = TRAINING_PARAMS_V2,
): MusclesAgainstPlan => {
  const inPlan = MUSCLE_IDS.filter((muscle) => values[muscle] !== NOT_IN_PLAN_INDEX).map(
    (muscle) => {
      const { actualWeeklySets, projectedWeeklySets, status } = comparison[muscle];
      return {
        muscle,
        done: actualWeeklySets,
        planned: projectedWeeklySets,
        status,
        isListed:
          status !== "on_plan" ||
          reachesGrowing(volumeStatusOf(projectedWeeklySets, muscleParams(muscle, params).volume)),
      };
    },
  );
  const rows = inPlan
    .filter(({ isListed }) => isListed)
    .sort(
      (a, b) =>
        hundredthsOf(a.done - a.planned) - hundredthsOf(b.done - b.planned) ||
        hundredthsOf(b.planned) - hundredthsOf(a.planned),
    )
    .map(({ muscle, done, planned, status }) => ({ muscle, done, planned, status }));
  return {
    scale: "gap",
    rows,
    moreOnPlan: inPlan.length - rows.length,
    notInPlan: MUSCLE_IDS.length - inPlan.length,
  };
};
