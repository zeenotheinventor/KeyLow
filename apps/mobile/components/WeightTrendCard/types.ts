import type { WeighIn } from "@keylow/api-client";
import type { TrendPoint } from "@keylow/core/engine";

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
};
