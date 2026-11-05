import type { MuscleDetail } from "@keylow/core/training";

export type WeeklySetsBarProps = {
  /** The sets this week and the volume bands, from the muscle detail. The bar's marks are worked out from it. */
  weeklySets: MuscleDetail["weeklySets"];
  /** The bar's accessible name, from core copy, so colour is never the only signal. */
  name: string;
  /** The numbers under the bar, from core copy: the start, and where Growing, Productive and High begin. */
  labels: { start: string; growing: string; productive: string; high: string };
};
