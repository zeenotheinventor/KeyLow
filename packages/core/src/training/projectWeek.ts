import { expandPlan, weekDays } from "./expandPlan";
import { muscleState } from "./muscleState";
import { isCalendarDay } from "../dates/calendarDay";

import type { CompareParams } from "./compareParams";
import type { PlanExercise, PlannedSet, PlanRoutine } from "./expandPlan";
import type { MuscleId } from "./muscles";
import type { HeatSet, MuscleState } from "./muscleState";
import type { WorkoutSessionRow, WorkoutSetRow } from "../schemas/training";

/*
 * Projected against actual for one week (ADR 0005): the logged sessions merged into the plan. Pure
 * under the ADR 0002 rule: `now` and the week are arguments, and nothing reads the clock.
 */

/** The fields of a `workout_sessions` row the merge reads. */
export type LoggedSession = Pick<
  WorkoutSessionRow,
  "id" | "local_date" | "routine_day_id" | "deleted_at"
>;

/** A logged set, with the session it belongs to. */
export type LoggedSet = HeatSet & Pick<WorkoutSetRow, "session_id">;

/**
 * A T5 suggestion the user accepted into a day. Accepted suggestions count as planned (ADR 0005), so
 * the week takes them as an input now; T5 decides what they add, and until then they are ignored.
 */
export type AcceptedSuggestion = Readonly<{
  /** The calendar day it was accepted into, `YYYY-MM-DD` in the week's zone. */
  local_date: string;
  /** The routine day it was folded into, or null when it stands alone. */
  routine_day_id: string | null;
  exercises: readonly PlanExercise[];
}>;

export type LoggedWeek = Readonly<{
  sessions: readonly LoggedSession[];
  sets: readonly LoggedSet[];
  /** Typed for T5 and not read yet. */
  acceptedSuggestions?: readonly AcceptedSuggestion[];
}>;

export type WeekProjection = {
  /** Every planned set of the week, as `expandPlan` gives them, whatever was logged. */
  planned: PlannedSet[];
  /** The live sets of the week's live sessions, planned or not. */
  actual: LoggedSet[];
  /**
   * The plan with what was logged in its place: a planned day the user logged gives its logged sets,
   * and one with no session, past or still to come, gives its planned sets.
   */
  projected: (PlannedSet | LoggedSet)[];
};

const requireLocalDate = (session: LoggedSession): void => {
  if (!isCalendarDay(session.local_date)) {
    throw new RangeError("A session's local date must be a calendar day written YYYY-MM-DD");
  }
};

/**
 * Merges what was logged in the week that starts on `weekStart` (a Monday, `YYYY-MM-DD`, in the IANA
 * zone `tz`) into the routine's plan for it.
 *
 * - A session is in the week when its `local_date`, the user's calendar day of its start, is one of the
 *   week's seven days, so a session just after local midnight on Monday is in the new week whatever
 *   the UTC date. Soft-deleted sessions and sets are left out, as are sets of a session not given.
 * - A session whose `routine_day_id` is a day of the routine replaces that day: the day's planned sets
 *   leave the projection and the session's logged sets take their place, however many there are and
 *   whichever day of the week it was logged on. Two sessions of one day both count.
 * - A session of a null-weekday day is from the plan too, so its sets count in both views, though the
 *   day itself is never placed.
 * - A planned day with no session stays in the projection, so a missed day shows as a gap.
 * - A session with no routine day, or with a day of another routine, counts in actual only.
 *
 * Throws a `RangeError` naming the rule for the inputs `expandPlan` refuses and for a session whose
 * local date is not a calendar day.
 */
export const projectWeek = (
  routine: PlanRoutine,
  weekStart: string,
  tz: string,
  logged: LoggedWeek,
  params: CompareParams,
): WeekProjection => {
  const planned = expandPlan(routine, weekStart, tz, params);
  const days = new Set(weekDays(weekStart));
  const routineDayIds = new Set(routine.days.map((day) => day.id));

  const sessions = logged.sessions.filter((session) => {
    requireLocalDate(session);
    return session.deleted_at === null && days.has(session.local_date);
  });
  const sessionIds = new Set(sessions.map((session) => session.id));
  const planSessionIds = new Set<string>();
  const loggedDayIds = new Set<string>();
  for (const { id, routine_day_id } of sessions) {
    if (routine_day_id !== null && routineDayIds.has(routine_day_id)) {
      planSessionIds.add(id);
      loggedDayIds.add(routine_day_id);
    }
  }

  const actual = logged.sets.filter(
    (set) => set.deleted_at === null && sessionIds.has(set.session_id),
  );
  const projected = [
    ...planned.filter((set) => !loggedDayIds.has(set.routine_day_id)),
    ...actual.filter((set) => planSessionIds.has(set.session_id)),
  ];
  return { planned, actual, projected };
};

/**
 * Projected heat at a moment: `muscleState` over the projected sets up to `at`, so it assumes the
 * plan was followed until then (and what was logged in its place where it was). Pass sets from before
 * the week with the projection when the heat window reaches back past Monday. Throws as `muscleState`
 * does.
 */
export const projectedState = (
  projected: readonly HeatSet[],
  at: string,
  params: CompareParams,
): Record<MuscleId, MuscleState> => muscleState(projected, at, params.training);
