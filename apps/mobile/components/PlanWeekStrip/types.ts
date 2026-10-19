import type { WeekPlan } from "@keylow/core/training";

export type PlanWeekStripProps = {
  /** The week as `weekPlanDays` gives it, with the session in progress already among its sessions. */
  week: WeekPlan;
  /** The Monday of the week, `YYYY-MM-DD`: the caption names the week from it. */
  weekStart: string;
};
