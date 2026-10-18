import type { DashboardToday } from "@keylow/api-client";
import type { TodayPlan } from "@keylow/core/copy";

/**
 * Today as the card's words take it: a named day with the sets it plans, rest, or nothing to say. A session
 * in progress follows the routine day it plans, and one that follows none has no name to write. A day
 * already done has no planned sets to state, so the card says nothing of it rather than "0 sets planned".
 */
export function todayPlanOf(today: DashboardToday): TodayPlan | null {
  switch (today.kind) {
    case "planned":
      return { kind: "session", routineDayName: today.dayName, plannedSets: today.setCount };
    case "in_progress":
      return today.dayName === null
        ? null
        : { kind: "session", routineDayName: today.dayName, plannedSets: today.setsPlanned };
    case "rest":
      return { kind: "rest" };
    case "done":
    case "none":
      return null;
  }
}
