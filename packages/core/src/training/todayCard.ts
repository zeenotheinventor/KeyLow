import { parseMoment } from "./muscleState";
import { estimateSessionMinutes } from "./sessionTime";
import { isOpenSession, workingSetsOf } from "./weekPlanDays";
import { addCalendarDays } from "../dates/calendarDay";

import type { SessionTimeParams } from "./sessionTime";
import type { PlannedDay, WeekPlan, WeekPlanDay, WeekSession } from "./weekPlanDays";

/*
 * The Train home's today block (ADR 0005, and Zee's ruling D on KEY-339: today shows what is logged).
 * Pure under the ADR 0002 rule: `now` and the params are arguments, and nothing reads the clock.
 */

/** The next planned day after today, wrapping into the following week, since a routine repeats. */
export type NextPlannedDay = Readonly<{
  /** `YYYY-MM-DD`. */
  date: string;
  id: string;
  name: string;
}>;

/** The first planned set not yet logged: the exercise, and which of its sets, from 1. */
export type NextSet = Readonly<{ exerciseId: string; setNumber: number }>;

export type TodayCard =
  | Readonly<{
      kind: "planned";
      routineName: string;
      dayName: string;
      /** "day 3 of 4" is `dayNumber` of `dayCount`. */
      dayNumber: number;
      dayCount: number;
      exerciseCount: number;
      setCount: number;
      estimatedMinutes: number;
    }>
  | Readonly<{
      kind: "in_progress";
      /** Null for a session that follows no routine day. */
      dayName: string | null;
      minutesSoFar: number;
      /** The working sets logged today, of the sets the day plans (0 when it plans none). */
      setsLogged: number;
      setsPlanned: number;
      /** Null when every planned set is logged, or the session follows no routine day. */
      nextSet: NextSet | null;
    }>
  | Readonly<{
      kind: "done";
      dayName: string | null;
      /** The whole minutes of the finished sessions, added up. */
      minutes: number;
      setsLogged: number;
      setsPlanned: number;
      next: NextPlannedDay | null;
    }>
  | Readonly<{ kind: "rest"; next: NextPlannedDay | null }>
  | Readonly<{ kind: "no_routine" }>
  | Readonly<{ kind: "first_time" }>;

export type TodayCardInput = Readonly<{
  week: WeekPlan;
  /** The moment to read the card at, an ISO timestamp with a zone. */
  now: string;
  sessionTimeParams: SessionTimeParams;
  /** Whether the person has ever logged a session. It is the one thing that tells a first visit apart. */
  hasEverLoggedSession: boolean;
}>;

const MILLISECONDS_PER_MINUTE = 60_000;
const DAYS_PER_WEEK = 7;

const nextPlannedDayAfter = (week: WeekPlan, date: string): NextPlannedDay | null => {
  const placed = week.days.flatMap((day) =>
    day.plannedDay === null
      ? []
      : [{ date: day.date, plannedDay: day.plannedDay, status: day.status }],
  );
  // A planned day already logged, on its date or another, is not next.
  const upcoming = placed.find((day) => day.date > date && day.status !== "logged");
  if (upcoming !== undefined) {
    return { date: upcoming.date, id: upcoming.plannedDay.id, name: upcoming.plannedDay.name };
  }
  const first = placed[0];
  return first === undefined
    ? null
    : {
        date: addCalendarDays(first.date, DAYS_PER_WEEK),
        id: first.plannedDay.id,
        name: first.plannedDay.name,
      };
};

/** The routine day the first of these sessions names, or the day planned for today. */
const dayOfSessions = (
  week: WeekPlan,
  sessions: readonly WeekSession[],
  today: WeekPlanDay,
): PlannedDay | null => {
  const named = week.routineDays.find((day) =>
    sessions.some((session) => session.routine_day_id === day.id),
  );
  return named ?? today.plannedDay;
};

const nextSetOf = (day: PlannedDay | null, sessions: readonly WeekSession[]): NextSet | null => {
  if (day === null) {
    return null;
  }
  const unspent = new Map<string, number>();
  for (const session of sessions) {
    for (const set of workingSetsOf(session)) {
      unspent.set(set.exercise_id, (unspent.get(set.exercise_id) ?? 0) + 1);
    }
  }
  // An exercise a day lists twice spends its logged sets on the first entry before the second.
  for (const exercise of day.exercises) {
    const logged = unspent.get(exercise.exerciseId) ?? 0;
    if (logged < exercise.targetSets) {
      return { exerciseId: exercise.exerciseId, setNumber: logged + 1 };
    }
    unspent.set(exercise.exerciseId, logged - exercise.targetSets);
  }
  return null;
};

const SESSION_TIME_RULE = "A session time must be an ISO timestamp with a zone";

const parseSessionTime = (time: string): number => parseMoment(time, SESSION_TIME_RULE);

const minutesBetween = (startedAt: string, endedAt: string): number =>
  Math.floor((parseSessionTime(endedAt) - parseSessionTime(startedAt)) / MILLISECONDS_PER_MINUTE);

const setsOf = (sessions: readonly WeekSession[]): number =>
  sessions.reduce((sets, session) => sets + workingSetsOf(session).length, 0);

/**
 * The block at the top of the Train home, for the day `week` holds as today:
 *
 * - `in_progress` when a session of today is open: the minutes since it started, the working sets
 *   logged today of the day's planned sets, and the next set to log.
 * - `done` when a session counts as today and every one is finished: the minutes and sets of those
 *   sessions, and the next planned day. A session that follows no routine day (or a routine day that is
 *   not today's) gives its own day, and a session on a rest day gives no day name.
 * - `planned` when today is a planned day with nothing started: the day, its place in the routine, its
 *   exercises and sets, and about how long it takes (`estimateSessionMinutes` with `sessionTimeParams`).
 * - `rest` on a rest day: the next planned day only. Which muscles are recovering is the screen's job.
 * - `no_routine` and `first_time` when there is no routine and nothing logged today. `first_time` is
 *   when `hasEverLoggedSession` is false.
 *
 * Throws a `RangeError` naming the rule when `week` does not hold today or a session's times are not
 * ISO timestamps with a zone.
 */
export const todayCard = ({
  week,
  now,
  sessionTimeParams,
  hasEverLoggedSession,
}: TodayCardInput): TodayCard => {
  const today = week.days.find((day) => day.date === week.today);
  if (today === undefined) {
    throw new RangeError("The today card needs a week that holds today");
  }

  const open = today.sessions.find(isOpenSession);
  if (open !== undefined) {
    const day = dayOfSessions(week, [open], today);
    return {
      kind: "in_progress",
      dayName: day?.name ?? null,
      minutesSoFar: Math.max(
        0,
        Math.floor(
          (parseMoment(now) - parseSessionTime(open.started_at)) / MILLISECONDS_PER_MINUTE,
        ),
      ),
      setsLogged: today.setsLogged,
      setsPlanned: day?.setCount ?? 0,
      nextSet: nextSetOf(day, today.sessions),
    };
  }

  // The finished sessions that count as today: the ones on its date, and a planned day's own session
  // logged on another date.
  const counted = week.sessions.flatMap((session) =>
    session.ended_at !== null &&
    (session.local_date === today.date ||
      (today.plannedDay !== null && session.routine_day_id === today.plannedDay.id))
      ? [{ session, endedAt: session.ended_at }]
      : [],
  );
  if (counted.length > 0) {
    const sessions = counted.map(({ session }) => session);
    const day = dayOfSessions(week, sessions, today);
    return {
      kind: "done",
      dayName: day?.name ?? null,
      minutes: counted.reduce(
        (minutes, { session, endedAt }) => minutes + minutesBetween(session.started_at, endedAt),
        0,
      ),
      setsLogged: setsOf(sessions),
      setsPlanned: day?.setCount ?? 0,
      next: nextPlannedDayAfter(week, today.date),
    };
  }

  if (week.routineName === null) {
    return hasEverLoggedSession ? { kind: "no_routine" } : { kind: "first_time" };
  }
  if (today.plannedDay === null) {
    return { kind: "rest", next: nextPlannedDayAfter(week, today.date) };
  }
  return {
    kind: "planned",
    routineName: week.routineName,
    dayName: today.plannedDay.name,
    dayNumber: today.plannedDay.dayNumber,
    dayCount: week.routineDayCount,
    exerciseCount: today.plannedDay.exercises.length,
    setCount: today.plannedDay.setCount,
    estimatedMinutes: estimateSessionMinutes(
      { exercises: today.plannedDay.exercises.length, sets: today.plannedDay.setCount },
      sessionTimeParams,
    ),
  };
};
