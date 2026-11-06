import type { SettlingChecklistInput } from "@keylow/core/program";

export type SettlingChecklistProps = SettlingChecklistInput;

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
