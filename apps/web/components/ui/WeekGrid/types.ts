import type { WeekDayTotals } from "@keylow/core/diary";

export type WeekGridDay = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  /** What the day added up to. Null when it has no entries. */
  totals: WeekDayTotals | null;
  isComplete: boolean;
};

export type WeekGridProps = {
  /** The grid's name for a screen reader, such as "Week of Mon 12 Oct". */
  label: string;
  /** The seven days, Monday to Sunday. The average is added after them. */
  days: readonly WeekGridDay[];
  /** Today, `YYYY-MM-DD`. It is framed, the days after it are dimmed and the average stops at it. */
  today: string;
  /** The daily calorie target. Null shows the calories without a bar. */
  calorieTarget: number | null;
  /** Where a day's date leads: the day on view. */
  dayHref: (localDate: string) => string;
  /** Called with the day to copy into today. */
  onCopyToToday: (localDate: string) => void;
  /** Dims every Copy to today and stops it responding, such as while offline. The date links are left alone. */
  copyDisabled?: boolean;
  /** A copy is on its way, so every Copy to today waits. */
  isCopying?: boolean;
  className?: string;
};
