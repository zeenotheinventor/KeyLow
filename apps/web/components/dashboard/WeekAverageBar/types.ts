import type { WeekSummary } from "@keylow/core/diary";

export type WeekAverageBarProps = {
  /** The week's average kcal. */
  averageKcal: number;
  /** The calorie target, null when none is set: the bar is left off and the unit stands alone. */
  targetKcal: WeekSummary["targetKcal"];
  /** How full the bar is, from 0 to 1, capped. Null with no target. */
  barFill: WeekSummary["barFill"];
  /** The whole kcal the average is over the target by. Null when it is not over. */
  kcalOverTarget: WeekSummary["kcalOverTarget"];
  /** The days with food logged before today, which the average is taken over. */
  daysLogged: number;
};
