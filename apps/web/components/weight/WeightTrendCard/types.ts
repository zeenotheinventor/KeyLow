import type { WeightChartView } from "@/lib/weightChartView";
import type { WeighIn } from "@keylow/api-client";
import type { TrendPoint } from "@keylow/core/engine";
import type { WeightRange } from "@keylow/core/weight";
import type { ReactNode } from "react";

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
  /** The range the chart draws, which the page holds so the Body composition cards use the same one. */
  range: WeightRange;
  /** The range control's choice. */
  onRangeChange: (range: WeightRange) => void;
  /** Which figure the card draws under its range control: the weight chart with its legend, or `composition`. */
  view: WeightChartView;
  /** The Chart view switch's choice. */
  onViewChange: (view: WeightChartView) => void;
  /** What replaces the weight chart and its legend in the `composition` view. */
  composition: ReactNode;
};
