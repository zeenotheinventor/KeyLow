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

const signed = (amount: number, unitWords: (size: number) => string): string =>
  `${amount < 0 ? TRUE_MINUS_SIGN : "+"}${unitWords(Math.abs(amount))}`;

const describeRepsChange = (repsChange: number): string =>
  repsChange === 0
    ? EXERCISE_TREND.noChange
    : signed(repsChange, (size) => describeCount(size, "rep", "reps"));

/**
 * The change of a trained week: "+5 kg" or "−5 kg" first, then "+2 reps" when the load is equal,
 * "No change" when nothing moved, "First week", and "Not trained yet" for no change at all (null, a range
 * with no trained week). The load change is the difference
 * of the two loads as they are shown (converted, then rounded to one decimal), so the change in pounds
 * always agrees with the two numbers beside it and never reads "+0.1 lb" from rounding drift. A load
 * change that shows as 0 falls back to the reps change.
 */
export const describeTrendChange = (change: TrendChange | null, unit: LoadUnit): string => {
  if (change === null) {
    return EXERCISE_TREND.notTrainedYet;
  }
  if (change.kind === "same") {
    return EXERCISE_TREND.noChange;
  }
  if (change.kind === "first") {
    return EXERCISE_TREND.firstWeek;
  }
  if (change.kind === "reps") {
    return describeRepsChange(change.repsChange);
  }

  const shownDifference =
    Math.round(
      (displayWeight(change.latestLoadKg ?? 0, unit) -
        displayWeight(change.previousLoadKg ?? 0, unit)) *
        10,
    ) / 10;
  return shownDifference === 0
    ? describeRepsChange(change.repsChange)
    : signed(shownDifference, (size) => `${size} ${unit}`);
};
