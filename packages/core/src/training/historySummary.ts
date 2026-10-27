import { z } from "zod";

import { requireTimeZone } from "./expandPlan";
import { MUSCLE_IDS } from "./muscles";
import { weightedSetsByMuscle } from "./muscleState";
import { TRAINING_PARAMS_V2 } from "./params";
import { addCalendarDays, daysSinceMonday, isCalendarDay } from "../dates/calendarDay";

import type { MuscleId } from "./muscles";
import type { TrainingParams } from "./params";
import type { SetSnapshot, WorkoutSessionRow, WorkoutSetRow } from "../schemas/training";

/*
 * What the history list and the session detail show about a logged session (ADR 0005, "Projected
 * against actual", and Zee's rulings on KEY-339: a week is Monday to Sunday, and what was logged
 * replaces what was planned). Pure under the ADR 0002 rule: the zone and the params are arguments, and
 * nothing reads the clock. Warm-ups never count as working sets and soft-deleted rows never count at all.
 */

/** The fields of a `workout_sessions` row the history reads. */
export type HistorySession = Pick<
  WorkoutSessionRow,
  "id" | "started_at" | "ended_at" | "local_date" | "deleted_at"
>;

/** The fields of a `workout_sets` row the history reads. */
export type HistorySet = Pick<
  WorkoutSetRow,
  "id" | "exercise_id" | "position" | "set_type" | "rir" | "rpe" | "performed_at" | "deleted_at"
> & {
  snapshot: Pick<SetSnapshot, "muscles">;
};

/** A session with the sets read from it, which is how `groupSessionsByWeek` takes a session. */
export type HistorySessionWithSets = HistorySession & { sets: readonly HistorySet[] };

export type SessionWeek<Session extends HistorySessionWithSets = HistorySessionWithSets> = {
  /** The Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
  sessionCount: number;
  /** The working sets of the week's sessions: working, drop and failure, with no warm-ups. */
  workingSetTotal: number;
  /** The week's live sessions, newest first. */
  sessions: Session[];
};

export type SessionSummary = {
  /** Whole minutes from start to end, or null while the session is open. */
  durationMinutes: number | null;
  workingSets: number;
  warmupSets: number;
  /** Up to three muscles, those with the most effective sets first. */
  topMuscles: MuscleId[];
  /**
   * The routine day's name, or null for a free session. The wording "Session" is copy (`TRAIN_TODAY_CARD.sessionName`).
   * `summariseSession` leaves it null: the session row holds the name, and the caller sets it.
   */
  titleSource: string | null;
};

const TOP_MUSCLE_COUNT = 3;
const MILLISECONDS_PER_MINUTE = 60_000;
const WARMUP: WorkoutSetRow["set_type"] = "warmup";

// The schemas' timestamp rule: a zone designator is required, so a time never depends on the device zone.
const timestampSchema = z.iso.datetime({ offset: true });

const parseTimestamp = (timestamp: string, rule: string): number => {
  if (!timestampSchema.safeParse(timestamp).success) {
    throw new RangeError(rule);
  }
  return Date.parse(timestamp);
};

const SESSION_TIME_RULE = "A session's times must be ISO timestamps with a zone";
const SET_TIME_RULE = "A set's performed_at must be an ISO timestamp with a zone";

/** The fields of a set that say where it sits in its session and whether it counts at all. Not exported from the package. */
export type OrderableSet = Pick<HistorySet, "id" | "position" | "performed_at" | "deleted_at">;

const isLive = (set: Pick<HistorySet, "deleted_at">): boolean => set.deleted_at === null;

const workingSetsOf = (sets: readonly HistorySet[]): HistorySet[] =>
  sets.filter((set) => isLive(set) && set.set_type !== WARMUP);

/** Compares text by code unit, which for ids of one case is the order a database gives. */
const compareText = (first: string, second: string): number => {
  if (first === second) {
    return 0;
  }
  return first < second ? -1 : 1;
};

/**
 * The live sets of a session in the order a screen lists them: by `position`, then by when each was
 * performed (as a moment, so a zone offset does not reorder them), then by `id`. Soft-deleted sets are
 * left out. Returns a new array.
 *
 * Throws a `RangeError` naming the rule when a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const orderSessionSets = <Set extends OrderableSet>(sets: readonly Set[]): Set[] =>
  sets
    .filter(isLive)
    .map((set) => ({ set, performedAt: parseTimestamp(set.performed_at, SET_TIME_RULE) }))
    .sort(
      (first, second) =>
        first.set.position - second.set.position ||
        first.performedAt - second.performedAt ||
        compareText(first.set.id, second.set.id),
    )
    .map(({ set }) => set);

const weekStartOf = (localDate: string): string => {
  if (!isCalendarDay(localDate)) {
    throw new RangeError("A session's local date must be a calendar day written YYYY-MM-DD");
  }
  return addCalendarDays(localDate, -daysSinceMonday(localDate));
};

/**
 * Groups sessions by the calendar week, Monday to Sunday, of their `local_date`, newest week first and
 * newest session (by `started_at`, then `id`) first within a week. The week comes from `local_date`,
 * the user's calendar day of the start, and never from the UTC date, so a session just after local
 * midnight on a Monday is in the new week, and a clock change moves no session to another week.
 * Soft-deleted sessions are left out, and so is a week that has only those. Each group carries the
 * session count and the working-set total of its sessions.
 *
 * `tz` is the user's IANA zone. It is checked and not used to place a session, because `local_date`
 * already holds the day the user's clock showed.
 *
 * Throws a `RangeError` naming the rule when `tz` is not an IANA name, a local date is not a calendar
 * day, or a start time is not an ISO timestamp with a zone.
 */
export const groupSessionsByWeek = <Session extends HistorySessionWithSets>(
  sessions: readonly Session[],
  tz: string,
): SessionWeek<Session>[] => {
  requireTimeZone(tz);
  const live = sessions
    .map((session) => ({
      session,
      weekStart: weekStartOf(session.local_date),
      startedAt: parseTimestamp(session.started_at, SESSION_TIME_RULE),
    }))
    .filter(({ session }) => isLive(session))
    .sort(
      (first, second) =>
        second.startedAt - first.startedAt || compareText(second.session.id, first.session.id),
    );

  const weeks = new Map<string, Session[]>();
  for (const { session, weekStart } of live) {
    weeks.set(weekStart, [...(weeks.get(weekStart) ?? []), session]);
  }
  return [...weeks]
    .sort(([first], [second]) => compareText(second, first))
    .map(([weekStart, weekSessions]) => ({
      weekStart,
      sessionCount: weekSessions.length,
      workingSetTotal: weekSessions.reduce(
        (total, session) => total + workingSetsOf(session.sets).length,
        0,
      ),
      sessions: weekSessions,
    }));
};

const durationMinutesOf = (session: Pick<HistorySession, "started_at" | "ended_at">) => {
  const startedAt = parseTimestamp(session.started_at, SESSION_TIME_RULE);
  if (session.ended_at === null) {
    return null;
  }
  const endedAt = parseTimestamp(session.ended_at, SESSION_TIME_RULE);
  return Math.floor((endedAt - startedAt) / MILLISECONDS_PER_MINUTE);
};

const topMusclesOf = (workingSets: readonly HistorySet[], params: TrainingParams): MuscleId[] => {
  const effectiveSets = weightedSetsByMuscle(workingSets, params);
  // The list is in muscle list order and a sort is stable, so equal effective sets stay in list order.
  return MUSCLE_IDS.filter((muscle) => effectiveSets[muscle] > 0)
    .sort((first, second) => effectiveSets[second] - effectiveSets[first])
    .slice(0, TOP_MUSCLE_COUNT);
};

/**
 * What the history list shows of one session, from the session and the sets read from it. Working sets
 * are working, drop and failure sets. Warm-ups are counted apart and never in the total. The top muscles
 * are the three with the most effective sets (`weight × effort` from each set's snapshot, so editing an
 * exercise later changes nothing), ties broken by the muscle list order, and a muscle with no effective
 * set is left out. Soft-deleted sets count for nothing.
 *
 * The summary never compares the sets with a routine: a past session shows what was done, and a routine
 * edited since would make any comparison wrong.
 *
 * `params` defaults to the current version, so a summary of an old session follows the current effort
 * numbers, as the heat of an old session does.
 *
 * Throws a `RangeError` naming the rule when a time is not an ISO timestamp with a zone.
 */
export const summariseSession = (
  session: Pick<HistorySession, "started_at" | "ended_at">,
  sets: readonly HistorySet[],
  params: TrainingParams = TRAINING_PARAMS_V2,
): SessionSummary => {
  const workingSets = workingSetsOf(sets);
  return {
    durationMinutes: durationMinutesOf(session),
    workingSets: workingSets.length,
    warmupSets: sets.filter((set) => isLive(set) && set.set_type === WARMUP).length,
    topMuscles: topMusclesOf(workingSets, params),
    titleSource: null,
  };
};
