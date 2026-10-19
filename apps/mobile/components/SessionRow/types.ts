export type SessionRowProps = {
  /** The date block's top line: "Tue". */
  weekday: string;
  /** The date block's bottom line: "13". */
  dayOfMonth: string;
  /** The routine day's name, or "Session". */
  title: string;
  /** "51 min · 17 sets". */
  meta: string;
  /** "Lats · biceps · mid traps", or null when no muscle worked. */
  muscles: string | null;
  /** The row's name for a screen reader: the session, its day and its figures. */
  accessibilityLabel: string;
};
