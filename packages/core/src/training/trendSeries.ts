import { displayWeight } from "../weight/units";

import type { TrendEntry } from "./exerciseTrend";
import type { LoadUnit } from "./loads";

/** One plotted week: its Monday and the number to draw, or null for a skipped week. */
export type TrendSeriesPoint = Readonly<{ week: string; value: number | null }>;

/** What a chart draws: the points, and the unit they are in. A series with no load at all is drawn in reps. */
export type TrendSeries = Readonly<{
  unit: LoadUnit | "reps";
  points: readonly TrendSeriesPoint[];
}>;

/**
 * The weeks of a trend as numbers to plot. The value is the week's load as it is shown in `unit`, so the
 * chart agrees with the list beside it. An exercise with no load in any week (bodyweight) is plotted in reps.
 * When some weeks have a load, a week with none counts as 0, the same rule the change follows. A skipped
 * week stays a gap.
 */
export const trendSeries = (weeks: readonly TrendEntry[], unit: LoadUnit): TrendSeries => {
  const hasLoad = weeks.some((entry) => entry.value !== null && entry.value.loadKg !== null);
  return {
    unit: hasLoad ? unit : "reps",
    points: weeks.map(({ weekStart, value }) => ({
      week: weekStart,
      value: value === null ? null : hasLoad ? displayWeight(value.loadKg ?? 0, unit) : value.reps,
    })),
  };
};
