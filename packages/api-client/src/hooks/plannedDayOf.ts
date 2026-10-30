import { daysSinceMonday } from "@keylow/core/dates";

import type { PlanRoutine, PlanRoutineDay } from "@keylow/core/training";

/**
 * The routine day planned for the local calendar day `day` (`YYYY-MM-DD`): the day whose weekday is the
 * weekday of `day`, or undefined when the routine has none, or when `day` is before the routine was made
 * active (the plan places nothing before `activeFrom`, as `expandPlan` does). A day with no weekday means
 * "any day" and is never placed on the calendar.
 */
export function plannedDayOf(
  routine: (PlanRoutine & { days: readonly PlanRoutineDay[] }) | null,
  day: string,
): PlanRoutineDay | undefined {
  if (routine === null || (routine.activeFrom !== undefined && day < routine.activeFrom)) {
    return undefined;
  }
  const weekday = daysSinceMonday(day);
  return routine.days.find((candidate) => candidate.weekday === weekday);
}
