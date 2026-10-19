/** How a day's mark is drawn: a tick, the accent ring on the accent fill, the ring, the dashed ring, or the dash. */
export type WeekDayLook = "done" | "running" | "ring" | "planned" | "rest";

export type WeekDayProps = {
  /** The column head: "Mon". */
  weekday: string;
  /** The name under the mark: "Push", "Rest", or the sets of a session that is no part of the plan. Empty for none. */
  label: string;
  /** The whole day for a screen reader: "Thursday 15 October, today, Legs, planned, 16 sets". */
  accessibleName: string;
  look: WeekDayLook;
  isToday: boolean;
};
