import { describeScrubberDay } from "@keylow/core/copy";

import type { DayScrubberDay, DayScrubberDot } from "../DayScrubber";
import type { BodyMapDay } from "@keylow/api-client";
import type { ScrubberDayInput } from "@keylow/core/copy";

const DOTS: Record<BodyMapDay["status"], DayScrubberDot> = {
  logged: "logged",
  extra: "logged",
  in_progress: "running",
  planned: "planned",
  today: "planned",
  missed: "none",
  rest: "none",
};

function stateOf({
  status,
  plannedDayName,
  sessionDayName,
}: BodyMapDay): ScrubberDayInput["state"] {
  switch (status) {
    case "logged":
    case "extra":
      return { kind: "logged", routineDayName: sessionDayName };
    case "in_progress":
      return { kind: "in_progress", routineDayName: sessionDayName };
    case "planned":
    case "today":
      return { kind: "planned", routineDayName: plannedDayName };
    case "missed":
      return { kind: "missed", routineDayName: plannedDayName };
    case "rest":
      return { kind: "rest" };
  }
}

/**
 * The seven days of the hook as the scrubber draws them. A logged day, an extra session and a day a late make-up
 * replaced (KEY-531) read logged and are named by the routine day the session was done as, which Pick day
 * (KEY-505) can make other than the one planned. A planned day and today read planned, with the day planned.
 * A missed day and a rest day have no dot, as the Train week strip draws them, and say so in their name. A day
 * the view shown cannot choose is disabled, and its name says Projected has it, or that Projected needs a routine
 * when there is none.
 */
export function scrubberDaysOf(
  projectedAvailable: boolean,
  days: readonly BodyMapDay[],
): DayScrubberDay[] {
  return days.map((day) => {
    const { weekday, dayOfMonth, accessibleName } = describeScrubberDay({
      localDate: day.date,
      isToday: day.isToday,
      state: stateOf(day),
      onlyInProjected: !day.selectable,
      projectedNeedsRoutine: !projectedAvailable,
    });
    return {
      date: day.date,
      weekday,
      dayOfMonth,
      accessibleName,
      dot: DOTS[day.status],
      isToday: day.isToday,
      isDisabled: !day.selectable,
    };
  });
}
