import type { WeekDayTotals } from "@keylow/core/diary";

/** Which cell this is: a day before today, today, a day still to come, or the average of the week. */
export type WeekGridCellKind = "past" | "today" | "future" | "average";

export type WeekGridCellProps = {
  kind: WeekGridCellKind;
  /** What the cell is called, such as "Mon 12" or "Average". */
  name: string;
  /** Where the name leads. Without it the name is plain text. */
  href?: string | undefined;
  /** What the day added up to. Null when it has no entries. */
  totals: WeekDayTotals | null;
  /** What an empty cell says in place of "No entries yet", such as the average's reason it has no number. */
  emptyText?: string | undefined;
  /** A line under the numbers, such as the range the average covers. */
  caption?: string | undefined;
  /** The daily calorie target. Null shows the calories without a bar. */
  calorieTarget: number | null;
  /** The day is marked complete. */
  isComplete: boolean;
  /** Adds Copy to today to the cell. */
  onCopyToToday?: (() => void) | undefined;
  /** Copy to today is off, such as while offline. */
  copyDisabled: boolean;
  /** A copy is on its way, so Copy to today waits. */
  isCopying: boolean;
};
