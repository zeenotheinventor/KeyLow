import type { WeekPlan } from "@keylow/core/training";

export type PlanWeekStripProps = {
  /** The week as `weekPlanDays` gives it, with the session in progress already among its sessions. */
  week: WeekPlan;
  /** The Monday of the week, `YYYY-MM-DD`: the caption names the week from it. */
  weekStart: string;
  /**
   * Opens a logged day's session, given its id. A day is a button only when it holds a finished session and
   * this is given: with several finished sessions the one that ended last opens (`latestFinishedSession`).
   * Without it no day is pressable.
   */
  onViewSession?: ((sessionId: string) => void) | undefined;
};
