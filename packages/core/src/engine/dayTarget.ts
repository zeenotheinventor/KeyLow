import { daysSinceMonday } from "../dates";

import type { DayOfWeekKcal } from "./types";

export type DayTargetInput = Readonly<{
  /** The week's calories, in kilocalories. A manual target has only this. */
  caloriesKcal: number;
  /** The calories for each weekday, Monday first. Missing for a manual target. */
  dowCaloriesKcal?: DayOfWeekKcal;
}>;

export type DayAdjustments = Readonly<{
  /** Kilocalories to add to the day, as they are. Negative takes calories off. */
  kcal: number;
}>;

/**
 * The calories for one day: the one read path every screen that shows a day's target uses (ADR 0002,
 * Amendment 2, "Day-of-week offsets"). `localDate` is `YYYY-MM-DD`. Its weekday picks the figure from
 * `dowCaloriesKcal`, Monday first, and a target with none gives `caloriesKcal` every day. `adjustments` are
 * added as they are, so with none the result is exactly the stored figure. The weekday is read from the
 * date text alone: no clock and no time zone.
 */
export function dayTarget(
  { caloriesKcal, dowCaloriesKcal }: DayTargetInput,
  localDate: string,
  adjustments?: DayAdjustments,
): number {
  const dayKcal =
    dowCaloriesKcal === undefined ? caloriesKcal : dowCaloriesKcal[daysSinceMonday(localDate)];
  if (dayKcal === undefined) {
    throw new RangeError("A local date is a calendar day written YYYY-MM-DD.");
  }
  return dayKcal + (adjustments?.kcal ?? 0);
}
