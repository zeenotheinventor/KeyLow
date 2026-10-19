import type { HistoryWeek } from "@keylow/api-client";

export type HistoryWeekSectionProps = {
  week: HistoryWeek;
  /** The Monday of the week that holds today, `YYYY-MM-DD`: it names this week and last week. */
  thisWeekStart: string;
};
