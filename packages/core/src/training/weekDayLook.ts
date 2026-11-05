import type { WeekPlanDay } from "./weekPlanDays";

/** How a day of the week strip is drawn: the success fill, the accent ring on the accent fill, the ring, the dashed ring, or plain. */
export type WeekDayLook = "done" | "running" | "ring" | "planned" | "rest";

/**
 * How a day is drawn: the success fill for a logged day or a session that is no part of the plan, the accent
 * ring on the accent fill for a session in progress, the ring for today, the dashed ring for a planned day
 * still to come, and the plain day for a rest day and a missed one. A day with nothing planned and nothing
 * logged is plain too, except today when there is no routine, which is the ring since no rest was planned.
 * `hasRoutine` is whether the week has a routine day.
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
