import type { HistoryWeek } from "@keylow/api-client";

export type SessionsTableProps = {
  /** The calendar weeks to draw, newest first, each with its sessions newest first. */
  weeks: readonly HistoryWeek[];
  /** The Monday of the week that holds today, `YYYY-MM-DD`, which names "This week" and "Last week". */
  thisWeekStart: string;
};
