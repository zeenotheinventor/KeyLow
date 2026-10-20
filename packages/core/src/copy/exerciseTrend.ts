import { describeCount } from "./counts";
import { displayLoad } from "../training/loads";
import { displayWeight } from "../weight/units";

import type { TrendChange, TrendValue } from "../training/exerciseTrend";
import type { LoadUnit } from "../training/loads";

/**
 * The words of the weekly exercise trend (Zee's rulings, 2026-10-20): the three states with no number,
 * the value of a week and its change against the last week trained. Kilograms are stored, and the unit
 * only changes how a number is shown.
 */
export const EXERCISE_TREND = {
  noChange: "No change",
  firstWeek: "First week",
  notTrainedYet: "Not trained yet",
} as const;

const TRUE_MINUS_SIGN = "−";

/** A week's value: "15 kg" for a loaded week, "8 reps" for a week with no load. */
export const describeTrendValue = ({ loadKg, reps }: TrendValue, unit: LoadUnit): string =>
  loadKg === null ? describeCount(reps, "rep", "reps") : `${displayLoad(loadKg, unit)} ${unit}`;

/** Which way a week moved against the last trained week, and by how much: "5 kg", "2 reps". No sign. */
export type TrendMovement = Readonly<{ direction: "up" | "down"; amount: string }>;

const repsMovement = (repsChange: number): TrendMovement | null =>
  repsChange === 0
    ? null
    : {
        direction: repsChange < 0 ? "down" : "up",
        amount: describeCount(Math.abs(repsChange), "rep", "reps"),
      };

/**
 * How far a trained week moved, or null when it did not (a first week, an equal week, no change at all).
 * The load change comes first: the difference of the two loads as they are shown (converted, then rounded
 * to one decimal), so the change in pounds always agrees with the two numbers beside it and never reads
 * "+0.1 lb" from rounding drift. A load change that shows as 0 falls back to the reps change.
 */
export const describeTrendMovement = (
  change: TrendChange | null,
  unit: LoadUnit,
): TrendMovement | null => {
  if (change === null || change.kind === "first" || change.kind === "same") {
    return null;
  }
  if (change.kind === "reps") {
    return repsMovement(change.repsChange);
  }

  const shownDifference =
    Math.round(
      (displayWeight(change.latestLoadKg ?? 0, unit) -
        displayWeight(change.previousLoadKg ?? 0, unit)) *
        10,
    ) / 10;
  return shownDifference === 0
    ? repsMovement(change.repsChange)
    : {
        direction: shownDifference < 0 ? "down" : "up",
        amount: `${Math.abs(shownDifference)} ${unit}`,
      };
};

/**
 * The change of a trained week: "+5 kg" or "−5 kg" first, then "+2 reps" when the load is equal,
 * "No change" when nothing moved, "First week", and "Not trained yet" for no change at all (null, a range
 * with no trained week).
 */
export const describeTrendChange = (change: TrendChange | null, unit: LoadUnit): string => {
  if (change === null) {
    return EXERCISE_TREND.notTrainedYet;
  }
  if (change.kind === "first") {
    return EXERCISE_TREND.firstWeek;
  }
  const movement = describeTrendMovement(change, unit);
  return movement === null
    ? EXERCISE_TREND.noChange
    : `${movement.direction === "down" ? TRUE_MINUS_SIGN : "+"}${movement.amount}`;
};
