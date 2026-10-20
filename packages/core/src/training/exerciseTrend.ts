import { isWorkingType } from "./liveSets";
import { parseMoment } from "./muscleState";
import { addCalendarDays, daysSinceMonday, isCalendarDay } from "../dates/calendarDay";
import { isValidTimeZone } from "../dates/isValidTimeZone";
import { toLocalDate } from "../dates/toLocalDate";

import type { WorkoutSetRow } from "../schemas/training";

/*
 * The weekly exercise trend (KEY-506, Zee's rulings of 2026-10-20). One value per exercise per week, weeks
 * Monday to Sunday by the `local_date` of the set's session (the user's calendar day, ruling B on
 * KEY-339): the heaviest working-set load of the week with that set's reps. Values stay in kilograms; the
 * copy turns them into pounds for display. Pure under the ADR 0002 rule: `now` and the zone are
 * arguments and nothing reads the clock.
 */

/** The ranges of the trend: 4 weeks, 3 months and a year. */
export const TREND_RANGES = ["4w", "3m", "1y"] as const;

export type TrendRange = (typeof TREND_RANGES)[number];

/** How many weeks each range shows, the current week included. 3 months are 13 weeks, a year 52. */
export const TREND_RANGE_WEEKS: Readonly<Record<TrendRange, number>> = {
  "4w": 4,
  "3m": 13,
  "1y": 52,
};

const DAYS_PER_WEEK = 7;

export const requireCalendarDay = (day: string, rule: string): void => {
  if (!isCalendarDay(day)) {
    throw new RangeError(rule);
  }
};

export const mondayOf = (localDate: string): string =>
  addCalendarDays(localDate, -daysSinceMonday(localDate));

/**
 * The fields of a set that the trend reads: the set row's own and its session's `local_date`, flattened.
 * The sets given are one exercise's. A set or a session that has a `deleted_at` never counts, and a row
 * that was read as live only (the api-client's) leaves both out. Sets of a session still open count, as
 * they are logged.
 */
export type TrendSet = Pick<WorkoutSetRow, "set_type" | "reps" | "load_kg"> & {
  /** The calendar day of the set's session, `YYYY-MM-DD` in the user's zone. The set's week comes from it. */
  local_date: string;
  deleted_at?: string | null | undefined;
  session_deleted_at?: string | null | undefined;
};

/** The value of a week: its heaviest load and the most reps at that load. `loadKg` is null for a reps-only week. */
export type TrendValue = Readonly<{ loadKg: number | null; reps: number }>;

/**
 * How a trained week compares with the last week trained before it, which is not always the week before:
 * weeks skipped are gaps. `first` has nothing to compare with, `same` is equal in load and reps. The load
 * comes first, in kilograms (null for no load); when the loads are equal, bodyweight weeks included, it is
 * the reps change (`reps`, never 0). A `load` change carries the reps change too, for when the shown load
 * change rounds to nothing.
 */
export type TrendChange =
  | Readonly<{ kind: "first" }>
  | Readonly<{ kind: "same" }>
  | Readonly<{
      kind: "load";
      previousLoadKg: number | null;
      latestLoadKg: number | null;
      repsChange: number;
    }>
  | Readonly<{ kind: "reps"; repsChange: number }>;

/** One week of the series. A gap has neither a value nor a change. */
export type TrendEntry = Readonly<
  { weekStart: string } & (
    { value: TrendValue; change: TrendChange } | { value: null; change: null }
  )
>;

export type ExerciseTrend = Readonly<{
  /** Every week of the range, oldest first, the week of `now` last. */
  weeks: readonly TrendEntry[];
  /** The latest week with a value in the range, or null when the range has none. */
  latest: Extract<TrendEntry, { value: TrendValue }> | null;
}>;

const hasValue = (entry: TrendEntry): entry is Extract<TrendEntry, { value: TrendValue }> =>
  entry.value !== null;

const loadOf = (value: TrendValue): number => value.loadKg ?? 0;

/** Whether `candidate` beats `current`: a heavier load, or the same load for more reps. */
export const isBetter = (candidate: TrendValue, current: TrendValue | undefined): boolean =>
  current === undefined ||
  loadOf(candidate) > loadOf(current) ||
  (loadOf(candidate) === loadOf(current) && candidate.reps > current.reps);

/**
 * The value a set gives its week, or null when the set does not count: a warm-up, a deleted set or a set
 * of a deleted session. A load of null or 0 is no load.
 */
export const countedValueOf = (set: TrendSet): TrendValue | null =>
  (set.deleted_at ?? null) !== null ||
  (set.session_deleted_at ?? null) !== null ||
  !isWorkingType(set)
    ? null
    : { loadKg: set.load_kg !== null && set.load_kg > 0 ? set.load_kg : null, reps: set.reps };

// A move between a reps-only week and a loaded week is a load change: no load counts as 0 kg, so the
// week after a bodyweight week at 10 kg reads "+10 kg" and the reverse "−10 kg" (Zee's ruling: keep it).
const changeBetween = (previous: TrendValue, latest: TrendValue): TrendChange => {
  const repsChange = latest.reps - previous.reps;
  if (loadOf(previous) !== loadOf(latest)) {
    return {
      kind: "load",
      previousLoadKg: previous.loadKg,
      latestLoadKg: latest.loadKg,
      repsChange,
    };
  }
  return repsChange === 0 ? { kind: "same" } : { kind: "reps", repsChange };
};

/**
 * The weekly series of one exercise over `range`, ending with the week of `now` (an ISO timestamp with a
 * zone, read as a day in `timeZone`). A set counts in the week of its session's `local_date`. Every working
 * set counts, the drop and failure sets too, as in `workingSetsOf`; a warm-up, a deleted set and a set of
 * a deleted session never do. A load of null or 0 is no load, and a week with no loaded set has the best
 * reps (a reps-only week).
 *
 * `earlier` holds sets of weeks before the range, for the first trained week's change: the last week
 * trained before the range is the one it is compared with. Sets of a week after the current one are left out.
 *
 * Throws a `RangeError` naming the rule for a `now` that is not an ISO timestamp with a zone, a zone that
 * is not an IANA name, or a set whose `local_date` is not a calendar day. A message never holds a value.
 */
export const exerciseWeeklyTrend = (
  sets: readonly TrendSet[],
  {
    range,
    now,
    timeZone,
    earlier = [],
  }: { range: TrendRange; now: string; timeZone: string; earlier?: readonly TrendSet[] },
): ExerciseTrend => {
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("A trend's time zone must be an IANA zone name");
  }
  const instant = parseMoment(now, "A trend's now must be an ISO timestamp with a zone");
  const lastWeek = mondayOf(toLocalDate(new Date(instant), timeZone));

  const bestByWeek = new Map<string, TrendValue>();
  for (const set of [...earlier, ...sets]) {
    requireCalendarDay(
      set.local_date,
      "A set's local date must be a calendar day written YYYY-MM-DD",
    );
    const candidate = countedValueOf(set);
    if (candidate === null) {
      continue;
    }
    const weekStart = mondayOf(set.local_date);
    if (weekStart > lastWeek) {
      continue;
    }
    if (isBetter(candidate, bestByWeek.get(weekStart))) {
      bestByWeek.set(weekStart, candidate);
    }
  }

  const trainedWeeks = [...bestByWeek.keys()].sort();
  const weeks: TrendEntry[] = Array.from({ length: TREND_RANGE_WEEKS[range] }, (_, index) => {
    const weekStart = addCalendarDays(
      lastWeek,
      -(TREND_RANGE_WEEKS[range] - 1 - index) * DAYS_PER_WEEK,
    );
    const value = bestByWeek.get(weekStart);
    if (value === undefined) {
      return { weekStart, value: null, change: null };
    }
    const previousWeek = trainedWeeks.filter((week) => week < weekStart).at(-1);
    const previous = previousWeek === undefined ? undefined : bestByWeek.get(previousWeek);
    return {
      weekStart,
      value,
      change: previous === undefined ? { kind: "first" } : changeBetween(previous, value),
    };
  });

  return { weeks, latest: [...weeks].reverse().find(hasValue) ?? null };
};
