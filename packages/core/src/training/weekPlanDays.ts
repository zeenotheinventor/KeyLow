import { MAX_WEEKDAY, MIN_WEEKDAY } from "./bounds";
import { requireTimeZone, weekDays } from "./expandPlan";
import { parseMoment } from "./muscleState";
import { summariseRoutine } from "./summariseRoutine";
import { isCalendarDay } from "../dates/calendarDay";
import { toLocalDate } from "../dates/toLocalDate";

import type {
  RoutineDayRow,
  RoutineExerciseRow,
  WorkoutSessionRow,
  WorkoutSetRow,
} from "../schemas/training";

/*
 * The week as the Train home draws it (ADR 0005, "Projected against actual", and Zee's rulings on
 * KEY-339: a week is Monday to Sunday, what was logged replaces what was planned, and today shows what
 * is logged). Pure under the ADR 0002 rule: `now`, the week and the zone are arguments, and nothing
 * reads the clock. Soft-deleted sessions and sets never count, and a warm-up is never a working set.
 */

/** The fields of a `workout_sets` row the week reads. */
export type WeekSet = Pick<WorkoutSetRow, "exercise_id" | "set_type" | "deleted_at">;

/** The fields of a `workout_sessions` row the week reads, with the sets read from it. */
export type WeekSession = Pick<
  WorkoutSessionRow,
  "id" | "local_date" | "started_at" | "ended_at" | "routine_day_id" | "deleted_at"
> & { sets: readonly WeekSet[] };

/** A routine exercise as the week reads it. A stored `routine_exercises` row fits. */
export type WeekRoutineExercise = Pick<
  RoutineExerciseRow,
  "position" | "exercise_id" | "target_sets"
>;

/** A routine day as the week reads it. A stored day with its exercises fits. A null weekday means any day. */
export type WeekRoutineDay = Pick<RoutineDayRow, "id" | "name" | "position" | "weekday"> & {
  exercises: readonly WeekRoutineExercise[];
};

/** The active routine, as far as the week reads it. */
export type WeekRoutine = Readonly<{ name: string; days: readonly WeekRoutineDay[] }>;

export type WeekPlanInput = Readonly<{
  /** Null when the person has no active routine. */
  routine: WeekRoutine | null;
  /** The sessions to read, with their sets. Any week may be given, and the ones outside this week are left out. */
  sessions: readonly WeekSession[];
  /** The moment to read the week at, an ISO timestamp with a zone. */
  now: string;
  /** The user's IANA zone. It places `now` on a calendar day. */
  tz: string;
  /** The Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
}>;

export type PlannedExercise = Readonly<{ exerciseId: string; targetSets: number }>;

/** A routine day with what it plans. */
export type PlannedDay = Readonly<{
  id: string;
  name: string;
  /** Its place among the routine's days, from 1: the dated days by weekday, then the unplaced ones by position. */
  dayNumber: number;
  /** In the day's position order. */
  exercises: readonly PlannedExercise[];
  setCount: number;
}>;

/** A routine day with no weekday: never put on a date. */
export type UnplacedDay = Readonly<{
  plannedDay: PlannedDay;
  /** Whether a finished session of this day is in the week. */
  logged: boolean;
}>;

export const WEEK_DAY_STATUSES = [
  "logged",
  "in_progress",
  "today",
  "planned",
  "missed",
  "rest",
  "extra",
] as const;

/**
 * - `logged`: a finished session counts as the day.
 * - `in_progress`: a session of the date is open.
 * - `today`: today, planned, nothing started.
 * - `planned`: a planned day still to come.
 * - `missed`: a planned day that is over with no session.
 * - `rest`: no planned day and nothing logged.
 * - `extra`: a session that is no part of the plan, on a day with no planned day.
 */
export type WeekDayStatus = (typeof WEEK_DAY_STATUSES)[number];

export type WeekPlanDay = Readonly<{
  /** `YYYY-MM-DD`. */
  date: string;
  /** 0 (Monday) to 6 (Sunday). */
  weekday: number;
  isToday: boolean;
  plannedDay: PlannedDay | null;
  /** The live sessions whose `local_date` is this date, in the order they were given. */
  sessions: readonly WeekSession[];
  /** The working sets of those sessions. */
  setsLogged: number;
  /** The sets the planned day plans, or 0 when there is none. */
  setsPlanned: number;
  status: WeekDayStatus;
}>;

export type WeekPlan = Readonly<{
  /** The date of `now` in the zone, `YYYY-MM-DD`. It may be outside the week. */
  today: string;
  routineName: string | null;
  routineDayCount: number;
  /** The seven days, Monday first. */
  days: readonly WeekPlanDay[];
  /** The routine days with no weekday, after the dated ones. */
  unplaced: readonly UnplacedDay[];
  /** Every routine day, in the order of `dayNumber`. */
  routineDays: readonly PlannedDay[];
  /** The live sessions of the week. */
  sessions: readonly WeekSession[];
}>;

const SESSION_DATE_RULE = "A session's local date must be a calendar day written YYYY-MM-DD";

export const isOpenSession = (session: Pick<WeekSession, "ended_at">): boolean =>
  session.ended_at === null;

/** The working sets of a session: live, and not a warm-up. */
export const workingSetsOf = (session: WeekSession): WeekSet[] =>
  session.sets.filter((set) => set.deleted_at === null && set.set_type !== "warmup");

const checkRoutine = (routine: WeekRoutine): void => {
  const weekdays = new Set<number>();
  for (const day of routine.days) {
    if (day.weekday === null) {
      continue;
    }
    if (!Number.isInteger(day.weekday) || day.weekday < MIN_WEEKDAY || day.weekday > MAX_WEEKDAY) {
      throw new RangeError("A routine day's weekday must be 0 (Monday) to 6 (Sunday) or null");
    }
    if (weekdays.has(day.weekday)) {
      throw new RangeError("A routine has at most one day per weekday");
    }
    weekdays.add(day.weekday);
  }
};

const byPosition = (first: { position: number }, second: { position: number }): number =>
  first.position - second.position;

type DatedRoutineDay = WeekRoutineDay & { weekday: number };

const isDated = (day: WeekRoutineDay): day is DatedRoutineDay => day.weekday !== null;

const plannedDayOf = (day: WeekRoutineDay, dayNumber: number): PlannedDay => ({
  id: day.id,
  name: day.name,
  dayNumber,
  exercises: [...day.exercises]
    .sort(byPosition)
    .map((exercise) => ({ exerciseId: exercise.exercise_id, targetSets: exercise.target_sets })),
  // A routine of this one day: its sets in a week are the day's sets.
  setCount: summariseRoutine({ days: [day] }).setsPerWeek,
});

/**
 * The status of a planned day that has nothing logged against it, by where its date stands against
 * today.
 */
const statusOfUnloggedPlannedDay = (date: string, today: string): WeekDayStatus => {
  if (date < today) {
    return "missed";
  }
  return date === today ? "today" : "planned";
};

/**
 * The routine day a finished session is credited to: the day it names, when that is one of the
 * routine's days, otherwise the day planned on its date, otherwise none. An open session credits none.
 */
const creditedDayIdOf = (
  session: WeekSession,
  routineDayIds: ReadonlySet<string>,
  dates: readonly string[],
  plannedByWeekday: ReadonlyMap<number, PlannedDay>,
): string | null => {
  if (isOpenSession(session)) {
    return null;
  }
  if (session.routine_day_id !== null && routineDayIds.has(session.routine_day_id)) {
    return session.routine_day_id;
  }
  return plannedByWeekday.get(dates.indexOf(session.local_date))?.id ?? null;
};

type StatusInput = Readonly<{
  date: string;
  today: string;
  plannedDay: PlannedDay | null;
  sessions: readonly WeekSession[];
  /** The ids of the routine days a finished session of the week is credited to. */
  loggedDayIds: ReadonlySet<string>;
  routineDayIds: ReadonlySet<string>;
}>;

const statusOf = ({
  date,
  today,
  plannedDay,
  sessions,
  loggedDayIds,
  routineDayIds,
}: StatusInput): WeekDayStatus => {
  if (sessions.some(isOpenSession)) {
    return "in_progress";
  }
  if (plannedDay !== null) {
    return loggedDayIds.has(plannedDay.id) ? "logged" : statusOfUnloggedPlannedDay(date, today);
  }
  if (sessions.length === 0) {
    return "rest";
  }
  const followsRoutine = sessions.some(
    (session) => session.routine_day_id !== null && routineDayIds.has(session.routine_day_id),
  );
  return followsRoutine ? "logged" : "extra";
};

/**
 * The seven days of the week that starts on `weekStart` (a Monday, `YYYY-MM-DD`) in the IANA zone
 * `tz`, read at `now`.
 *
 * - A session is on the date of its `local_date`, the user's calendar day of its start, so one just
 *   after local midnight on Monday is Monday whatever the UTC date. Today is the date of `now` in `tz`.
 * - A finished session is credited to one routine day (logged replaces planned): the day it names, when
 *   that is one of the routine's days, placed or unplaced, and otherwise the day planned on its date.
 *   An open session is credited to none. A session credited to a day on another date leaves that
 *   date's own planned day uncredited.
 * - A date with a planned day reads `logged` when its day is credited, `in_progress` when a session
 *   there is open, and otherwise `today`, `planned` or `missed` by its date against today. Its
 *   sessions and sets stay on the date whoever they are credited to.
 * - A date with no planned day reads `in_progress` when a session there is open, `logged` when a
 *   finished one names a routine day (the plan was followed on another date), `extra` when a finished
 *   one does not, and `rest` otherwise.
 * - Two sessions credited to one planned day are still one logged day.
 * - A routine day with no weekday is never put on a date. It is listed in `unplaced`.
 *
 * Throws a `RangeError` naming the rule when the week does not start on a Monday, the zone is not an
 * IANA name, `now` is not an ISO timestamp with a zone, a session's local date is not a calendar day,
 * two routine days share a weekday, or a weekday is out of range.
 */
export const weekPlanDays = ({
  routine,
  sessions,
  now,
  tz,
  weekStart,
}: WeekPlanInput): WeekPlan => {
  const dates = weekDays(weekStart);
  requireTimeZone(tz);
  const today = toLocalDate(new Date(parseMoment(now)), tz);
  if (routine !== null) {
    checkRoutine(routine);
  }
  const weekSessions: WeekSession[] = [];
  for (const session of sessions) {
    if (session.deleted_at !== null) {
      continue;
    }
    if (!isCalendarDay(session.local_date)) {
      throw new RangeError(SESSION_DATE_RULE);
    }
    if (dates.includes(session.local_date)) {
      weekSessions.push(session);
    }
  }

  const routineDays = routine?.days ?? [];
  const dated = routineDays.filter(isDated).sort((first, second) => first.weekday - second.weekday);
  const undated = routineDays.filter((day) => !isDated(day)).sort(byPosition);
  const plannedDated = dated.map((day, index) => ({
    weekday: day.weekday,
    plannedDay: plannedDayOf(day, index + 1),
  }));
  const plannedUnplaced = undated.map((day, index) => plannedDayOf(day, dated.length + index + 1));
  const planned = [...plannedDated.map(({ plannedDay }) => plannedDay), ...plannedUnplaced];
  const plannedByWeekday = new Map(
    plannedDated.map(({ weekday, plannedDay }) => [weekday, plannedDay]),
  );

  const routineDayIds = new Set(planned.map((day) => day.id));
  const loggedDayIds = new Set<string>();
  for (const session of weekSessions) {
    const creditedDayId = creditedDayIdOf(session, routineDayIds, dates, plannedByWeekday);
    if (creditedDayId !== null) {
      loggedDayIds.add(creditedDayId);
    }
  }

  return {
    today,
    routineName: routine?.name ?? null,
    routineDayCount: planned.length,
    days: dates.map((date, weekday) => {
      const plannedDay = plannedByWeekday.get(weekday) ?? null;
      const daySessions = weekSessions.filter((session) => session.local_date === date);
      return {
        date,
        weekday,
        isToday: date === today,
        plannedDay,
        sessions: daySessions,
        setsLogged: daySessions.reduce((sets, session) => sets + workingSetsOf(session).length, 0),
        setsPlanned: plannedDay?.setCount ?? 0,
        status: statusOf({
          date,
          today,
          plannedDay,
          sessions: daySessions,
          loggedDayIds,
          routineDayIds,
        }),
      };
    }),
    unplaced: plannedUnplaced.map((plannedDay) => ({
      plannedDay,
      logged: loggedDayIds.has(plannedDay.id),
    })),
    routineDays: planned,
    sessions: weekSessions,
  };
};

export type WeekCaption = Readonly<{
  /** The routine's days: 0 when there is no routine. */
  plannedDayCount: number;
  /** The routine's days a finished session counts as ("2 of 4 done"). A day done twice counts once. */
  loggedDayCount: number;
  /** The finished sessions of the week, planned or not ("2 sessions" for a week with no routine). */
  loggedSessionCount: number;
}>;

/** What the week strip's caption counts. The wording is copy. */
export const weekCaption = (week: WeekPlan): WeekCaption => ({
  plannedDayCount: week.routineDayCount,
  loggedDayCount:
    week.days.filter((day) => day.plannedDay !== null && day.status === "logged").length +
    week.unplaced.filter((unplacedDay) => unplacedDay.logged).length,
  loggedSessionCount: week.sessions.filter((session) => !isOpenSession(session)).length,
});
