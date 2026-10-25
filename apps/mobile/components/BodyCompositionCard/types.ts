import type { BodyMeasurementKind, WeightRange } from "@keylow/core/weight";

type BodyCompositionCardBaseProps = {
  kind: BodyMeasurementKind;
  /** The latest trend value, unrounded. The card writes it to one decimal. */
  trend: number;
  /** The range chosen on the weight chart's range control, which words the change and the line's name. */
  range: WeightRange;
};

/** A settled trend with a change over the range. */
export type BodyCompositionChartCardProps = BodyCompositionCardBaseProps & {
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
export type BodyCompositionSettlingCardProps = BodyCompositionCardBaseProps & {
  state: "settling";
  /** How many readings the trend has so far. */
  readingCount: number;
  /** The trend for each day of the range as on a settled card, or `null` when no point is in the range. */
  line: readonly (number | null)[] | null;
};

/** A range with fewer than two readings in it: the value and the reason, with no change and no line. */
export type BodyCompositionRangeEmptyCardProps = BodyCompositionCardBaseProps & {
  state: "range-empty";
};

export type BodyCompositionCardProps =
  | BodyCompositionChartCardProps
  | BodyCompositionSettlingCardProps
  | BodyCompositionRangeEmptyCardProps;
