import type { WeekDayLook } from "@keylow/core/training";

export type WeekDayProps = {
  /** The column head: "Mon". */
  weekday: string;
  /** The name under the mark: "Push", "Rest", or the sets of a session that is no part of the plan. Empty for none. */
  label: string;
  /** The whole day for a screen reader: "Thursday 15 October, today, Legs, planned, 16 sets". */
  accessibleName: string;
  look: WeekDayLook;
  isToday: boolean;
  /** Opens what the day holds, such as its session. With it the day is a button. Without it the day only informs. */
  onPress?: (() => void) | undefined;
};
