export type SettlingChecklistProps = {
  /** The first check-in's date, `YYYY-MM-DD`: the day whose window the counts are over. */
  firstCheckinDate: string;
  /** Whole days from today to the first check-in, 0 on the day. */
  daysLeft: number;
  /** The user's local date, `YYYY-MM-DD`. */
  today: string;
};

/** One count the first check-in needs, drawn as a bar. */
export type SettlingChecklistRow = {
  label: string;
  /** The words the bar's accessible name starts with, before the count. */
  name: string;
  count: number;
  target: number;
};

export type SettlingChecklistView = {
  /** "First check-in Friday 6 November, in 9 days". */
  title: string;
  rows: readonly SettlingChecklistRow[];
  /** What to do to cover the full 14 days, or null when there is nothing to say. */
  tip: string | null;
};
