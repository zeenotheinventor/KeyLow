import type { WeekDayLook } from "./WeekDay";
import type { WeekPlanDay } from "@keylow/core/training";

/**
 * How a day's mark is drawn, as the `train · today` board does: a tick for a logged day or a session that is
 * no part of the plan, the accent ring on the accent fill for a session in progress, the ring for today, the
 * dashed ring for a planned day still to come, and the dash for a rest day and a missed one. A day with
 * nothing planned and nothing logged is a dash too, except today when there is no routine, which the board
 * draws as the ring since no rest was planned.
 */
export function weekDayLookOf(
  day: Pick<WeekPlanDay, "status" | "isToday">,
  hasRoutine: boolean,
): WeekDayLook {
  switch (day.status) {
    case "logged":
    case "extra":
      return "done";
    case "in_progress":
      return "running";
    case "today":
      return "ring";
    case "planned":
      return "planned";
    case "missed":
      return "rest";
    case "rest":
      return day.isToday && !hasRoutine ? "ring" : "rest";
  }
}
