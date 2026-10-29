import type { WeekSummary } from "@keylow/core/diary";

export type ThisWeekCardProps = {
  /** What the week adds up to, from core's `weekSummary`. */
  summary: WeekSummary;
  /** The card opens the weekly averages screen, which reads the same week. */
  onOpen: () => void;
};
