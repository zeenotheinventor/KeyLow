import type { MuscleDetail } from "@keylow/core/training";

export type WeeklySetsBarProps = {
  /** The sets this week against the target, from the muscle detail. The bar's marks are worked out from it. */
  weeklySets: MuscleDetail["weeklySets"];
  /** The bar's accessible name, from core copy, so colour is never the only signal. */
  name: string;
  /** The words under the bar, from core copy: the start, the minimum, the planned figure and the maximum. */
  labels: { start: string; minimum: string; planned: string; maximum: string };
};
