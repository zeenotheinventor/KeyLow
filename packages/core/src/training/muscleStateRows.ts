import { heatStepOf } from "./bodyMapValues";
import { heatPercentOf, readyInHoursOf } from "./heatReadout";
import { MUSCLE_IDS, MUSCLES } from "./muscles";
import { muscleParams } from "./muscleState";
import { TRAINING_PARAMS_V2 } from "./params";
import {
  VOLUME_STATUS_NAMES,
  describeHeatStep,
  describeWeekdayShortName,
  formatSetCount,
} from "../copy/bodyMap";
import { MUSCLE_NAMES } from "../copy/muscleNames";
import { formatClockTime } from "../dates/formatClockTime";
import { toLocalDate } from "../dates/toLocalDate";

import type { MuscleGroup, MuscleId } from "./muscles";
import type { MuscleState } from "./muscleState";

/*
 * What the assistant says about each muscle, in the words of the body map and its muscle sheet, so the model
 * never words or counts a muscle itself. Pure under the ADR 0002 rule: `now` is an argument. The sets are the
 * rolling 7 days of `currentMuscleState`, which is what the body map's hook gives.
 */

export type MuscleStateRow = {
  muscle: string;
  /** The heat step's name, "Warm". */
  heat: string;
  heat_percent: number;
  /** "now" when the muscle is ready, otherwise the weekday and local time it will be: "Thu 14:30". */
  ready_at: string;
  /** Effort-weighted sets in the last 7 days, to two decimals at most. */
  sets: number;
  /** Where Productive starts for this muscle, as the suggestion's reasons use it. */
  target: number;
  status: string;
  /** Whether the routine trains the muscle or the goal ranks it (core's `targetedMuscles`). */
  targeted: boolean;
};

export type MuscleStateRows = {
  rows: MuscleStateRow[];
  /** The sets and target of the area asked for, summed over its muscles, or null when none was asked for. */
  area: {
    name: MuscleGroup;
    sets: number;
    target: number;
    /** False when the routine and goal train none of the area's muscles, so the sums are of the whole area. */
    targeted: boolean;
  } | null;
  /** The sets over every muscle, which counts a set once for each muscle it works. */
  totalSets: number;
};

/** A set count rounded as the body map writes it, so the sum of a few tenths is not a hair off. */
const roundedSets = (sets: number): number => Number(formatSetCount(sets));

const targetOf = (muscle: MuscleId): number =>
  muscleParams(muscle, TRAINING_PARAMS_V2).volume.productiveFromSets;

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const readyAtOf = (readyAt: string, now: string, timeZone: string): string => {
  if (readyInHoursOf(readyAt, now) === 0) {
    return "now";
  }
  const readyDate = new Date(readyAt);
  return `${describeWeekdayShortName(toLocalDate(readyDate, timeZone))} ${formatClockTime(readyDate, timeZone)}`;
};

/**
 * One row for each muscle of `area` (all 22 when it is null), in the order of the muscle list, and the
 * sets and target of the area summed over its targeted muscles, so they describe the same muscles. `states` is `currentMuscleState` at `now`, and the days and clock
 * times are read in `timeZone`.
 */
export const muscleStateRows = (
  states: Readonly<Record<MuscleId, MuscleState>>,
  {
    now,
    timeZone,
    area,
    targeted,
  }: {
    now: string;
    timeZone: string;
    area: MuscleGroup | null;
    /** The muscles the routine and the goal target, which an area's sets and target are summed over. */
    targeted: ReadonlySet<MuscleId>;
  },
): MuscleStateRows => {
  const muscles = MUSCLE_IDS.filter((muscle) => area === null || MUSCLES[muscle].group === area);
  // With none of the area targeted there is no basis to leave any out, as `targetedMuscles` does for the whole body.
  const targetedInArea = muscles.filter((muscle) => targeted.has(muscle));
  const summed = targetedInArea.length === 0 ? muscles : targetedInArea;
  return {
    rows: muscles.map((muscle) => {
      const state = states[muscle];
      return {
        muscle: MUSCLE_NAMES[muscle],
        heat: describeHeatStep(heatStepOf(muscle, state.heat)),
        heat_percent: heatPercentOf(state.heat),
        ready_at: readyAtOf(state.readyAt, now, timeZone),
        sets: roundedSets(state.weeklySets),
        target: targetOf(muscle),
        status: VOLUME_STATUS_NAMES[state.volumeStatus],
        targeted: targeted.has(muscle),
      };
    }),
    area:
      area === null
        ? null
        : {
            name: area,
            sets: roundedSets(sum(summed.map((muscle) => states[muscle].weeklySets))),
            target: sum(summed.map(targetOf)),
            targeted: targetedInArea.length > 0,
          },
    totalSets: roundedSets(sum(MUSCLE_IDS.map((muscle) => states[muscle].weeklySets))),
  };
};
