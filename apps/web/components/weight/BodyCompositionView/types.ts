import type { TrendPoint } from "@keylow/core/engine";
import type { BodySplitUnit, WeightRange } from "@keylow/core/weight";

export type BodyCompositionViewProps = {
  /** The weight trend, as `useWeightTrend` gives it. The view never works it out again. */
  weightPoints: readonly TrendPoint[];
  /** The range chosen on the trend card's range control. */
  range: WeightRange;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
  /** What the two lines are in: kilograms, or per cent of the weight trend. */
  unit: BodySplitUnit;
  onUnitChange: (unit: BodySplitUnit) => void;
};
