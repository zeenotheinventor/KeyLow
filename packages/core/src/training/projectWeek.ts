import { expandPlan, plannedSetsOfExercises, requireTimeZone, weekDays } from "./expandPlan";
import { muscleState, parseMoment } from "./muscleState";
import { isCalendarDay } from "../dates/calendarDay";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { toLocalDate } from "../dates/toLocalDate";

import type { CompareParams } from "./compareParams";
import type { PlannedSet, PlanRoutine } from "./expandPlan";
import type { MuscleId } from "./muscles";
import type { HeatSet, MuscleState } from "./muscleState";
import type { AcceptedExercise } from "./suggest/toAcceptedExercises";
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
 * A T5 suggestion the user accepted into a day, as far as the projection reads it (the live rows of
 * `accepted_suggestions`, parsed by `acceptedSuggestionSchema`). Accepted suggestions count as planned
 * (ADR 0005), and the exercises are the ones the suggestion added, not the planned ones it kept.
 */
export type AcceptedSuggestion = Readonly<{
  /** The calendar day it was accepted into, `YYYY-MM-DD` in the week's zone. */
  local_date: string;
  /** The routine day it was folded into, or null when it stands alone. */
  routine_day_id: string | null;
  exercises: readonly AcceptedExercise[];
}>;

export type LoggedWeek = Readonly<{
  sessions: readonly LoggedSession[];
  sets: readonly LoggedSet[];
  /** The live accepted suggestions, any week. Left out, none. */
  acceptedSuggestions?: readonly AcceptedSuggestion[];
}>;

export type WeekProjection = {
  /**
   * Every planned set of the week, whatever was logged: the routine's as `expandPlan` gives them, then
   * those of the accepted suggestions in the order given.
   */
  planned: PlannedSet[];
  /** The live sets of the week's live sessions, planned or not. Never an accepted suggestion's. */
  actual: LoggedSet[];
  /**
   * The plan with what was logged in its place: a planned day the user logged gives its logged sets,
   * and one with no session, past or still to come, gives its planned sets. An accepted suggestion
   * gives its planned sets until a session stands in for it.
   */
  projected: (PlannedSet | LoggedSet)[];
};

const requireLocalDate = (session: LoggedSession): void => {
  if (!isCalendarDay(session.local_date)) {
    throw new RangeError("A session's local date must be a calendar day written YYYY-MM-DD");
  }
};

const requireSuggestionDate = (suggestion: AcceptedSuggestion): void => {
  if (!isCalendarDay(suggestion.local_date)) {
    throw new RangeError(
      "An accepted suggestion's local date must be a calendar day written YYYY-MM-DD",
    );
  }
};

/** The planned sets of an accepted suggestion, at the planned time of its day, as a routine day's are. */
const plannedSetsOfSuggestion = (
  suggestion: AcceptedSuggestion,
  tz: string,
  params: CompareParams,
): PlannedSet[] => {
  const { hour, minute } = params.plannedTime;
  const performedAt = instantAtLocalTime(suggestion.local_date, hour, minute, tz).toISOString();
  return plannedSetsOfExercises(
    suggestion.exercises,
    suggestion.routine_day_id,
    suggestion.local_date,
    performedAt,
  );
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
 * - A session with no routine day, or with a day of another routine, counts in actual only, unless it
 *   is on the date of an accepted suggestion, which it replaces (below).
 * - An accepted suggestion of the week is planned on its `local_date` at the planned time, its exercises
 *   expanded as a routine day's are, from the snapshot stored with each. Its sets are in `planned` and
 *   `projected`, never in `actual`. It is replaced by what was logged:
 *   - A suggestion folded into a day of the routine lives and dies with that day: it is replaced only
 *     when that day is logged, on any date, as the day's own sets are. A free session on its date does
 *     not replace it.
 *   - A standalone suggestion (null routine day, or a day the routine does not have) is replaced when
 *     a live session of the week is on its date, whatever that session is, and the session's logged
 *     sets stand in its place. With no session on its date it stays planned, so a missed one shows as
 *     a gap.
 *   - A suggestion on a date outside the week is left out.
 *
 * Throws a `RangeError` naming the rule for the inputs `expandPlan` refuses and for a session or an
 * accepted suggestion whose local date is not a calendar day.
 */
export const projectWeek = (
  routine: PlanRoutine,
  weekStart: string,
  tz: string,
  logged: LoggedWeek,
  params: CompareParams,
): WeekProjection => {
  const routinePlanned = expandPlan(routine, weekStart, tz, params);
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

  const suggestions = (logged.acceptedSuggestions ?? []).filter((suggestion) => {
    requireSuggestionDate(suggestion);
    return days.has(suggestion.local_date);
  });
  const suggestionPlanned = suggestions.map((suggestion) => ({
    suggestion,
    sets: plannedSetsOfSuggestion(suggestion, tz, params),
  }));
  const sessionDates = new Set(sessions.map((session) => session.local_date));
  const isOfLoggedDay = ({ routine_day_id }: { routine_day_id: string | null }): boolean =>
    routine_day_id !== null && loggedDayIds.has(routine_day_id);
  // A suggestion folded into a day of the routine lives and dies with that day. Any other (no day, or a
  // day the routine does not have) stands alone, and a session on its date replaces it.
  const isFolded = ({ routine_day_id }: { routine_day_id: string | null }): boolean =>
    routine_day_id !== null && routineDayIds.has(routine_day_id);
  const replaced = (suggestion: AcceptedSuggestion): boolean =>
    isFolded(suggestion) ? isOfLoggedDay(suggestion) : sessionDates.has(suggestion.local_date);
  const standaloneDates = new Set(
    suggestions
      .filter((suggestion) => !isFolded(suggestion))
      .map((suggestion) => suggestion.local_date),
  );
  // A session on a standalone suggestion's date stands in for it, whether or not it is from the plan.
  const standInSessionIds = new Set(
    sessions
      .filter((session) => standaloneDates.has(session.local_date))
      .map((session) => session.id),
  );

  const actual = logged.sets.filter(
    (set) => set.deleted_at === null && sessionIds.has(set.session_id),
  );
  const planned = [...routinePlanned, ...suggestionPlanned.flatMap(({ sets }) => sets)];
  const projected = [
    ...routinePlanned.filter((set) => !isOfLoggedDay(set)),
    ...suggestionPlanned
      .filter(({ suggestion }) => !replaced(suggestion))
      .flatMap(({ sets }) => sets),
    ...actual.filter(
      (set) => planSessionIds.has(set.session_id) || standInSessionIds.has(set.session_id),
    ),
  ];
  return { planned, actual, projected };
};

/**
 * Projected heat at a moment: `muscleState` over the projected sets up to `at`, so it assumes the plan
 * was followed until then (and what was logged in its place where it was). A logged set counts once
 * `at` has reached its `performed_at`. A planned set counts only when its `local_date` is before the
 * local date of `at` in the IANA zone `tz` (the zone given to `projectWeek`), so today's unlogged
 * planned session adds nothing until the day after, and what is logged today shows as it is logged
 * (Zee, KEY-339 ruling D). A counted planned set decays from `params.plannedTime` on its own day. Pass
 * sets from before the week with the projection when the heat window reaches back past Monday.
 *
 * Throws a `RangeError` naming the rule when `tz` is not an IANA name, and as `muscleState` does for
 * the other inputs.
 */
export const projectedState = (
  projected: readonly (PlannedSet | LoggedSet)[],
  at: string,
  tz: string,
  params: CompareParams,
): Record<MuscleId, MuscleState> => {
  requireTimeZone(tz);
  const today = toLocalDate(new Date(parseMoment(at)), tz);
  const counted = projected.filter((set) => !("planned" in set) || set.local_date < today);
  return muscleState(counted, at, params.training);
};
