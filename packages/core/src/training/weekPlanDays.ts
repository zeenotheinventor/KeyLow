import { MAX_WEEKDAY, MIN_WEEKDAY } from "./bounds";
import { requireActiveFrom, requireTimeZone, weekDays } from "./expandPlan";
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

/**
 * The active routine, as far as the week reads it. `activeFrom` is the local calendar day the routine
 * was made active, `YYYY-MM-DD` in the user's zone, as in `PlanRoutine`. Left out, the routine plans the
 * whole week.
 */
export type WeekRoutine = Readonly<{
  name: string;
  days: readonly WeekRoutineDay[];
  activeFrom?: string;
}>;

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

/**
 * One day of the week. Screens draw a day by its `status`. A `rest` day may still carry the
 * `plannedDay` it would have had, as a day before the routine's `activeFrom` does.
 */
export type WeekPlanDay = Readonly<{
  /** `YYYY-MM-DD`. */
  date: string;
  /** 0 (Monday) to 6 (Sunday). */
  weekday: number;
  isToday: boolean;
  plannedDay: PlannedDay | null;
  /**
   * The live sessions whose `local_date` is this date, in the order they were given, without the ones that
   * make up an earlier day (`madeUpBy` of that day).
   */
  sessions: readonly WeekSession[];
  /** The working sets of those sessions, and of the session that makes this day up. */
  setsLogged: number;
  /**
   * The sets the day on this date plans: the routine day an open session of the date names, otherwise the
   * planned day, or 0 when there is none.
   */
  setsPlanned: number;
  /**
   * The routine day the sessions of this date name (the first in routine order), or null when none names
   * one. It is the day actually done or being done, which is not the planned day when a session was started
   * for another day (Pick day).
   */
  sessionDay: Readonly<{ id: string; name: string }> | null;
  /**
   * The finished session that makes this day up, or null. A day that was missed and is done later in the same
   * week reads `logged` and holds that session here: its `sessions` stay those of its own date, and its
   * `setsLogged` and `sessionDay` are the make-up's.
   */
  madeUpBy: WeekSession | null;
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

const SESSION_END_RULE = "A session time must be an ISO timestamp with a zone";

const compareText = (first: string, second: string): number => {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
};

/**
 * The finished session that ended last, or null when none has finished. The session detail opens it from
 * a day that holds several (KEY-492 allows that). The ends are compared as moments, so a zone offset does
 * not reorder them. A tie goes to the later start, then to the later id, so the answer never depends on
 * the order the sessions were read in. An open session is never the answer.
 *
 * Throws a `RangeError` naming the rule when a time is not an ISO timestamp with a zone.
 */
export const latestFinishedSession = <Session extends WeekSession>(
  sessions: readonly Session[],
): Session | null => {
  const finished = sessions.flatMap((session) =>
    session.ended_at === null
      ? []
      : [
          {
            session,
            endedAt: parseMoment(session.ended_at, SESSION_END_RULE),
            startedAt: parseMoment(session.started_at, SESSION_END_RULE),
          },
        ],
  );
  const [latest] = finished.sort(
    (first, second) =>
      second.endedAt - first.endedAt ||
      second.startedAt - first.startedAt ||
      compareText(second.session.id, first.session.id),
  );
  return latest?.session ?? null;
};

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
 * today. A date before the day the routine became active was never part of its plan, so it reads
 * `rest`, never `missed`.
 */
const statusOfUnloggedPlannedDay = (
  date: string,
  today: string,
  activeFrom: string | undefined,
): WeekDayStatus => {
  if (activeFrom !== undefined && date < activeFrom) {
    return "rest";
  }
  if (date < today) {
    return "missed";
  }
  return date === today ? "today" : "planned";
};

/**
 * The routine day a finished session is credited to. A finished session fills the slot of its own date: it
 * credits the day planned on its date, whichever routine day it names (a day picked in place of the planned
 * one counts for the planned one's slot, and the day it names keeps its own date). A date with no planned
 * day has no slot, so a session that names a day with no weekday credits that day instead, and any other
 * credits none. One session credits at most one day. An open session credits none.
 */
const creditedDayIdOf = (
  session: WeekSession,
  unplacedDayIds: ReadonlySet<string>,
  dates: readonly string[],
  plannedByWeekday: ReadonlyMap<number, PlannedDay>,
): string | null => {
  if (isOpenSession(session)) {
    return null;
  }
  const slotDay = plannedByWeekday.get(dates.indexOf(session.local_date));
  if (slotDay !== undefined) {
    return slotDay.id;
  }
  return session.routine_day_id !== null && unplacedDayIds.has(session.routine_day_id)
    ? session.routine_day_id
    : null;
};

type MakeUpsInput = Readonly<{
  /** The live sessions of the week. */
  sessions: readonly WeekSession[];
  dates: readonly string[];
  /** The ids of the routine days with a weekday, with that weekday. */
  weekdayByDayId: ReadonlyMap<string, number>;
  activeFrom: string | undefined;
}>;

type FinishedSession = Readonly<{ session: WeekSession; startedAt: number }>;

/** Oldest first: by date, then by the moment the session started, then by id. */
const compareOldestFirst = (first: FinishedSession, second: FinishedSession): number =>
  compareText(first.session.local_date, second.session.local_date) ||
  first.startedAt - second.startedAt ||
  compareText(first.session.id, second.session.id);

/**
 * The finished sessions that make up an earlier day of their week, by the date they make up. Sessions are
 * judged oldest first, so every date before the one judged is settled: a finished session of routine day X
 * on date D makes up X's date P when P is in the week before D, is not before the routine's `activeFrom`, no
 * session counts for P (an open one does, a session that itself makes up a day does not), and no earlier
 * session already made P up. Otherwise it counts for D, which is what makes P taken for later sessions.
 */
const settleMakeUps = ({
  sessions,
  dates,
  weekdayByDayId,
  activeFrom,
}: MakeUpsInput): ReadonlyMap<string, WeekSession> => {
  const takenDates = new Set(sessions.filter(isOpenSession).map((session) => session.local_date));
  const madeUpByDate = new Map<string, WeekSession>();
  const finished = sessions
    .filter((session) => !isOpenSession(session))
    .map((session) => ({ session, startedAt: parseMoment(session.started_at, SESSION_END_RULE) }))
    .sort(compareOldestFirst);
  for (const { session } of finished) {
    const weekday =
      session.routine_day_id === null ? undefined : weekdayByDayId.get(session.routine_day_id);
    const madeUpDate = weekday === undefined ? undefined : dates[weekday];
    const canMakeUp =
      madeUpDate !== undefined &&
      madeUpDate < session.local_date &&
      (activeFrom === undefined || madeUpDate >= activeFrom) &&
      !takenDates.has(madeUpDate) &&
      !madeUpByDate.has(madeUpDate);
    if (canMakeUp) {
      madeUpByDate.set(madeUpDate, session);
    } else {
      takenDates.add(session.local_date);
    }
  }
  return madeUpByDate;
};

type StatusInput = Readonly<{
  date: string;
  today: string;
  plannedDay: PlannedDay | null;
  sessions: readonly WeekSession[];
  /** The ids of the routine days a finished session of the week is credited to. */
  loggedDayIds: ReadonlySet<string>;
  /** The ids of the routine days with no weekday. */
  unplacedDayIds: ReadonlySet<string>;
  /** The local day the routine became active, when it has one. */
  activeFrom: string | undefined;
}>;

const statusOf = ({
  date,
  today,
  plannedDay,
  sessions,
  loggedDayIds,
  unplacedDayIds,
  activeFrom,
}: StatusInput): WeekDayStatus => {
  if (sessions.some(isOpenSession)) {
    return "in_progress";
  }
  if (plannedDay !== null) {
    return loggedDayIds.has(plannedDay.id)
      ? "logged"
      : statusOfUnloggedPlannedDay(date, today, activeFrom);
  }
  if (sessions.length === 0) {
    return "rest";
  }
  const followsUnplacedDay = sessions.some(
    (session) => session.routine_day_id !== null && unplacedDayIds.has(session.routine_day_id),
  );
  return followsUnplacedDay ? "logged" : "extra";
};

/**
 * The seven days of the week that starts on `weekStart` (a Monday, `YYYY-MM-DD`) in the IANA zone
 * `tz`, read at `now`.
 *
 * - A session is on the date of its `local_date`, the user's calendar day of its start, so one just
 *   after local midnight on Monday is Monday whatever the UTC date. Today is the date of `now` in `tz`.
 * - Otherwise a finished session fills the slot of the date it is on (a day picked in place of the planned one counts
 *   for the planned one's slot, and the picked day keeps its own date, which stays planned). It credits the
 *   day planned on its date, whichever routine day it names. On a date with no planned day, one that names
 *   a routine day with no weekday credits that day instead, since that day has no date of its own. One
 *   session credits at most one day. An open session credits none.
 * - A late make-up counts for the day it replaced. A finished session that names a routine day whose date
 *   this week is earlier than the session's own date makes that earlier day up, when the routine was active
 *   on it, no session counts for it (an open one does, one that itself makes up a day does not) and no
 *   earlier session already made it up. The earlier day then reads `logged` with the session in
 *   `madeUpBy`, and the session does not count for its own date, which reads as without it (planned,
 *   missed, rest, never extra). Sessions are judged oldest first (date, then the moment they started, then
 *   id), so a chain holds: Monday missed, Tuesday does Monday's day, Wednesday does Tuesday's day. A missed
 *   day done in the next week credits nothing. Any other session is credited as below.
 * - A date with a planned day reads `logged` when its day is credited, `in_progress` when a session
 *   there is open, and otherwise `today`, `planned` or `missed` by its date against today, or `rest`
 *   when its date is before the routine's `activeFrom` (the routine plans from the day it was made
 *   active). Its `sessionDay` is the day its sessions name, which is the day actually done.
 * - A date with no planned day reads `in_progress` when a session there is open, `logged` when a
 *   finished one names a routine day with no weekday, `extra` when a finished one does not, and `rest`
 *   otherwise: a day picked on a rest day is an extra day.
 * - Two sessions credited to one planned day are still one logged day.
 * - A routine day with no weekday is never put on a date. It is listed in `unplaced`.
 *
 * Throws a `RangeError` naming the rule when the week does not start on a Monday, the zone is not an
 * IANA name, `now` is not an ISO timestamp with a zone, a session's local date is not a calendar day,
 * the routine's `activeFrom` is not a calendar day, two routine days share a weekday, or a weekday is
 * out of range.
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
    requireActiveFrom(routine.activeFrom);
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

  const unplacedDayIds = new Set(plannedUnplaced.map((day) => day.id));
  const madeUpByDate = settleMakeUps({
    sessions: weekSessions,
    dates,
    weekdayByDayId: new Map(
      plannedDated.map(({ weekday, plannedDay }) => [plannedDay.id, weekday]),
    ),
    activeFrom: routine?.activeFrom,
  });
  const madeUpSessions = new Set(madeUpByDate.values());
  const countedSessions = weekSessions.filter((session) => !madeUpSessions.has(session));
  const loggedDayIds = new Set<string>();
  for (const session of countedSessions) {
    const creditedDayId = creditedDayIdOf(session, unplacedDayIds, dates, plannedByWeekday);
    if (creditedDayId !== null) {
      loggedDayIds.add(creditedDayId);
    }
  }
  for (const date of madeUpByDate.keys()) {
    const madeUpDay = plannedByWeekday.get(dates.indexOf(date));
    if (madeUpDay !== undefined) {
      loggedDayIds.add(madeUpDay.id);
    }
  }

  return {
    today,
    routineName: routine?.name ?? null,
    routineDayCount: planned.length,
    days: dates.map((date, weekday) => {
      const plannedDay = plannedByWeekday.get(weekday) ?? null;
      const daySessions = countedSessions.filter((session) => session.local_date === date);
      const madeUpBy = madeUpByDate.get(date) ?? null;
      const sessionDay =
        madeUpBy === null
          ? (planned.find((day) =>
              daySessions.some((session) => session.routine_day_id === day.id),
            ) ?? null)
          : plannedDay;
      const openDay = daySessions.some(isOpenSession) ? sessionDay : null;
      return {
        date,
        weekday,
        isToday: date === today,
        plannedDay,
        sessions: daySessions,
        setsLogged: [...daySessions, ...(madeUpBy === null ? [] : [madeUpBy])].reduce(
          (sets, session) => sets + workingSetsOf(session).length,
          0,
        ),
        setsPlanned: (openDay ?? plannedDay)?.setCount ?? 0,
        sessionDay: sessionDay === null ? null : { id: sessionDay.id, name: sessionDay.name },
        madeUpBy,
        status: statusOf({
          date,
          today,
          plannedDay,
          sessions: daySessions,
          loggedDayIds,
          unplacedDayIds,
          activeFrom: routine?.activeFrom,
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
