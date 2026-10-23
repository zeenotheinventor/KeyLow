import type { HistoryWeek } from "@keylow/api-client";

export type HistoryWeekSectionProps = {
  week: HistoryWeek;
  /** The Monday of the week that holds today, `YYYY-MM-DD`: it names this week and last week. */
  thisWeekStart: string;
  /** Opens a finished session of the week, given its id. */
  onOpenSession: (sessionId: string) => void;
  /** Resumes the session in progress: its row is pressed, where the others open their detail. */
  onResumeSession: () => void;
};
