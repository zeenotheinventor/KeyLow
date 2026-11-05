import type { WeekDayLook } from "@keylow/core/training";

export type PlanWeekDayProps = {
  /** The column head: "Mon". */
  weekday: string;
  /** The name under the weekday: "Push", "Rest", or the sets of a session that is no part of the plan. Empty for none. */
  label: string;
  /** The whole day for a screen reader: "Thursday 15 October, today, Legs, planned, 16 sets". */
  accessibleName: string;
  look: WeekDayLook;
  isToday: boolean;
};
