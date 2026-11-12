import { bodyLineSeries } from "./bodyLineSeries";
import { bodyChangeOverRange, bodyPointsInRange } from "./bodyTrendHelpers";

import type { BodyMeasurementKind, BodyTrendPoint } from "./bodyTypes";
import type { WeightRange } from "./types";

type BodyCompositionCardBase = {
  kind: BodyMeasurementKind;
  /** The latest trend value, unrounded. The card writes it to one decimal. */
  trend: number;
  /** The range chosen on the weight chart's range control, which words the change and the line's name. */
  range: WeightRange;
};

/** A settled trend with a change over the range. */
export type BodyCompositionChartCardData = BodyCompositionCardBase & {
  state: "chart";
  /** The change over the range, unrounded: percentage points for body fat and kilograms for lean mass. */
  change: number;
  /**
   * The trend for each day of the range, oldest first, with `null` for a day before the first point, so
   * the line is placed by date and not stretched across the width.
   */
  line: readonly (number | null)[];
};

/** Fewer than 7 readings: the value, the count so far and the line when the range has a point, with no change. */
export type BodyCompositionSettlingCardData = BodyCompositionCardBase & {
  state: "settling";
  /** How many readings the trend has so far. */
  readingCount: number;
  /** The trend for each day of the range as on a settled card, or `null` when no point is in the range. */
  line: readonly (number | null)[] | null;
};

/** A range with fewer than two readings in it: the value and the reason, with no change and no line. */
export type BodyCompositionRangeEmptyCardData = BodyCompositionCardBase & {
  state: "range-empty";
};

export type BodyCompositionCardData =
  | BodyCompositionChartCardData
  | BodyCompositionSettlingCardData
  | BodyCompositionRangeEmptyCardData;

/**
 * What one kind's card shows over a range, or `undefined` when the kind has no trend point at all. A
 * settling trend has the count and the line when the range holds a point, and no change. A settled trend
 * has the change and the line, unless the range holds fewer than two points or has no change, which is the
 * value and the reason alone.
 */
export function buildBodyCompositionCard(
  kind: BodyMeasurementKind,
  trend: { points: readonly BodyTrendPoint[]; settling: boolean },
  range: WeightRange,
  today: string,
): BodyCompositionCardData | undefined {
  const latest = trend.points.at(-1);
  if (latest === undefined) {
    return undefined;
  }
  const base = { kind, trend: latest.trend, range };
  const pointsInRange = bodyPointsInRange(trend.points, range, today);
  if (trend.settling) {
    return {
      ...base,
      state: "settling",
      readingCount: latest.nObs,
      line: pointsInRange.length === 0 ? null : bodyLineSeries(pointsInRange, range, today),
    };
  }
  const change = bodyChangeOverRange(trend.points, range, today);

  return change === null || pointsInRange.length < 2
    ? { ...base, state: "range-empty" }
    : { ...base, state: "chart", change, line: bodyLineSeries(pointsInRange, range, today) };
}
