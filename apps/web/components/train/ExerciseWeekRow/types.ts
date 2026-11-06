import type { ProgressChange } from "@keylow/core/copy";

export type ExerciseWeekRowProps = {
  /** The Monday the week starts on, such as "Mon 14 Sep". */
  weekLabel: string;
  /** The value with its reps, such as "62.5 kg for 6 reps". Null for a skipped week, which says "Not trained". */
  value: string | null;
  /** The change in words, with the sign. Green for a rise and red for a fall, and the words carry it as well. */
  change: ProgressChange<"up" | "down" | null> | null;
  /** The row said in full, for a screen reader. */
  accessibleName: string;
  /** Whether the chart has this week selected. */
  selected: boolean;
  /** Selects the week on the chart. A skipped week has no point, so it has no handler and is plain information. */
  onPress?: (() => void) | undefined;
};
