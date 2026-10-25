import type { WeightChartView } from "../../lib/weightChartView";
import type { WeighIn } from "@keylow/api-client";
import type { TrendPoint } from "@keylow/core/engine";
import type { WeightRange } from "@keylow/core/weight";
import type { ReactNode } from "react";

/** The two things the trend card can draw under its range control. */
export type WeightTrendCardView = WeightChartView;

export type WeightTrendCardProps = {
  /** Every weigh-in, as the hook returns them. */
  weighIns: readonly WeighIn[];
  /** The trend over them, as `useWeightTrend` returns it. The card never works it out again. */
  trend: {
    points: readonly TrendPoint[];
    /** The change over the last 7 days, or null when the trend is too short to say. */
    weeklyRateKg: number | null;
    settling: boolean;
  };
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
  /**
   * The range the screen holds, so one control can drive the weight chart and the Body composition cards.
   * Without it the card holds its own range, which starts on 90 days and is not kept.
   */
  range?: WeightRange;
  /** Called with the range that was pressed. With a `range`, the card shows it only when it is given back. */
  onRangeChange?: (range: WeightRange) => void;
  /**
   * Which figure the card draws under the range control: the weight chart with its legend (the default), or
   * `composition` where one is given. It only changes when the screen gives another, as the range does.
   */
  view?: WeightTrendCardView;
  /** Called with the view that was pressed. Giving it draws the Chart view switch between the card and the range control. */
  onViewChange?: (view: WeightTrendCardView) => void;
  /** What replaces the weight chart and its legend in the `composition` view. Without it that view draws the weight chart. */
  composition?: ReactNode;
};
