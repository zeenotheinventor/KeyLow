import type { WeekSummary } from "@keylow/core/diary";

export type ThisWeekCardProps = {
  /** What the week adds up to, from core's `weekSummary`. */
  summary: WeekSummary;
  /** The card opens the Diary on today, where the week strip shows the same week. */
  onOpenDiary: () => void;
};
