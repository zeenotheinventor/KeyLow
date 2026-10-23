import { heatStepOf } from "./bodyMapValues";
import { heatPercentOf, readyInHoursOf } from "./heatReadout";
import { MUSCLE_GROUPS, MUSCLE_IDS, MUSCLES } from "./muscles";

import type { MuscleGroup, MuscleId } from "./muscles";
import type { MuscleState } from "./muscleState";

/*
 * The muscle list of the body map (`body · muscle-list`): the 22 muscles in 7 groups, each row holding what
 * the screen writes. Pure under the ADR 0002 rule: `now` is an argument. The screen builds its sentences
 * ("Warm · ready in 19 h") from these fields, so no maths lives in it.
 */

export type MuscleListRow = {
  muscle: MuscleId;
  /** The heat, rounded to a whole percent. */
  heatPercent: number;
  /** The heat step, from 0 to 5. */
  heatStep: number;
  /** Whole hours until the muscle is ready, and 0 when it is ready now. */
  readyInHours: number;
};

export type MuscleListGroup = {
  group: MuscleGroup;
  /** The group's muscles in the order of the muscle list. */
  rows: MuscleListRow[];
};

/**
 * The muscles grouped in the order of the list (chest, shoulders, back, arms, core, legs, neck), each
 * group's rows in the order of the muscle list, and each muscle once. `states` are the heat and ready
 * time of every muscle at `now`: Actual from `muscleState`, or Projected from `projectedState`.
 *
 * Throws a `RangeError` naming the rule when `now` or a ready time is not an ISO timestamp with a zone.
 */
export const muscleListGroups = (
  states: Readonly<Record<MuscleId, Pick<MuscleState, "heat" | "readyAt">>>,
  now: string,
): MuscleListGroup[] =>
  MUSCLE_GROUPS.map((group) => ({
    group,
    rows: MUSCLE_IDS.filter((muscle) => MUSCLES[muscle].group === group).map((muscle) => {
      const heatPercent = heatPercentOf(states[muscle].heat);
      return {
        muscle,
        heatPercent,
        heatStep: heatStepOf(muscle, states[muscle].heat),
        readyInHours: readyInHoursOf(states[muscle].readyAt, now),
      };
    }),
  }));
