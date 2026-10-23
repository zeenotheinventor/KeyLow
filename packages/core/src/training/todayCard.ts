import { parseMoment } from "./muscleState";
import { estimateSessionMinutes } from "./sessionTime";
import { isOpenSession, latestFinishedSession, workingSetsOf } from "./weekPlanDays";
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

/** An earlier day of the week that today's session made up. */
export type MadeUpDay = Readonly<{
  /** The date of the day made up, `YYYY-MM-DD`. */
  date: string;
  /** The routine day it planned, as the routine names it. */
  dayName: string;
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
      /** The earlier days today's finished sessions made up, when they made any up. */
      madeUp?: readonly MadeUpDay[];
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
  | Readonly<{
      kind: "rest";
      next: NextPlannedDay | null;
      /** The earlier days today's finished sessions made up, when they made any up. */
      madeUp?: readonly MadeUpDay[];
    }>
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
    day.plannedDay === null ? [] : [{ date: day.date, plannedDay: day.plannedDay }],
  );
  // The next planned day after the date. A day done in place of another leaves that day's date planned.
  const upcoming = placed.find((day) => day.date > date);
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

/**
 * The finished sessions that count as today: the ones on its date, whichever routine day they were started
 * for, except one that makes up an earlier day, which counts for that day. A planned day's own session
 * logged on another date is that date's, and leaves today planned.
 */
const finishedSessionsOfToday = (today: WeekPlanDay): { session: WeekSession; endedAt: string }[] =>
  today.sessions.flatMap((session) =>
    session.ended_at === null ? [] : [{ session, endedAt: session.ended_at }],
  );

/** The earlier days of the week that a session of today made up, oldest first. */
const daysMadeUpToday = (week: WeekPlan, today: WeekPlanDay): MadeUpDay[] =>
  week.days.flatMap((day) =>
    day.madeUpBy?.local_date === today.date && day.plannedDay !== null
      ? [{ date: day.date, dayName: day.plannedDay.name }]
      : [],
  );

/** The field a planned or rest card holds for the days made up today, left out when none were. */
const madeUpFieldOf = (week: WeekPlan, today: WeekPlanDay): { madeUp?: readonly MadeUpDay[] } => {
  const madeUp = daysMadeUpToday(week, today);
  return madeUp.length === 0 ? {} : { madeUp };
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
 * The block at the top of the Train home, for the day `week` holds as today. A session of today that makes
 * up an earlier day counts for that day, so it leaves today's own slot open (KEY-531): the card reads
 * `planned` or `rest` as usual, with the days made up in `madeUp`. A session picked in place of today's
 * day that makes up nothing still fills today's slot, and reads `done`.
 *
 * - `in_progress` when a session of today is open: the minutes since it started, the working sets
 *   logged today of the day's planned sets, and the next set to log.
 * - `done` when a session counts as today and every one is finished: the minutes and sets of those
 *   sessions, and the next planned day. A session that follows no routine day (or a routine day that is
 *   not today's, as when a day was picked in place of it) gives its own day, and a session on a rest day
 *   gives no day name. The next planned day is the next one after today whatever was done today, since a
 *   day picked in place of another leaves that day planned.
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

  const counted = finishedSessionsOfToday(today);
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
  // A `rest` day that still carries a planned day is one before the routine was made active.
  if (today.plannedDay === null || today.status === "rest") {
    return {
      kind: "rest",
      next: nextPlannedDayAfter(week, today.date),
      ...madeUpFieldOf(week, today),
    };
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
    ...madeUpFieldOf(week, today),
  };
};

/**
 * The session the Today card's View session opens: the one of the sessions the Done card counts that ended
 * last (`latestFinishedSession`), or null when the card is not a Done card. A card that adds up two sessions
 * still opens one, the later.
 *
 * Throws a `RangeError` naming the rule when the week does not hold today or a session's times are not ISO
 * timestamps with a zone.
 */
export const todaySessionToView = (week: WeekPlan): WeekSession | null => {
  const today = week.days.find((day) => day.date === week.today);
  if (today === undefined) {
    throw new RangeError("The today card needs a week that holds today");
  }
  return latestFinishedSession(finishedSessionsOfToday(today).map(({ session }) => session));
};
