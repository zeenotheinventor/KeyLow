import { MAX_TARGET_SETS, MAX_WEEKDAY, MIN_TARGET_SETS, MIN_WEEKDAY } from "./bounds";
import { buildSetSnapshot } from "./buildSetSnapshot";
import { addCalendarDays, daysSinceMonday, isCalendarDay } from "../dates/calendarDay";
import { instantAtLocalTime } from "../dates/instantAtLocalTime";
import { isValidTimeZone } from "../dates/isValidTimeZone";

import type { SnapshotExercise } from "./buildSetSnapshot";
import type { CompareParams } from "./compareParams";
import type { HeatSet } from "./muscleState";
import type {
  ExerciseMuscleEntry,
  RoutineDayRow,
  RoutineExerciseRow,
  SetSnapshot,
} from "../schemas/training";

/*
 * The plan side of ADR 0005, "Projected against actual": the active routine's days placed on their
 * weekdays for one week, each routine exercise expanded into its target sets. Pure under the ADR 0002
 * rule: the week, the zone and the params are arguments, and nothing reads the clock.
 */

/** One routine exercise, with the exercise it names and that exercise's current muscle map. */
export type PlanExercise = Pick<
  RoutineExerciseRow,
  "id" | "position" | "exercise_id" | "target_sets" | "target_rir"
> & {
  exercise: SnapshotExercise;
  muscles: readonly ExerciseMuscleEntry[];
};

/** One routine day with its exercises. A null weekday means any day. */
export type PlanRoutineDay = Pick<RoutineDayRow, "id" | "position" | "weekday"> & {
  exercises: readonly PlanExercise[];
};

/**
 * The active routine, as far as the plan reads it. `activeFrom` is the local calendar day the routine
 * was made active, `YYYY-MM-DD` in the user's zone: the plan places no set before it. Left out, the
 * routine plans the whole week.
 */
export type PlanRoutine = Readonly<{ days: readonly PlanRoutineDay[]; activeFrom?: string }>;

/**
 * A set the plan expects: the shape `muscleState` and `weeklyVolume` read, so they run on it unchanged,
 * marked `planned: true`, with the routine day and exercise it came from. It is a working set at the
 * routine exercise's target RIR (no effort measure, so full effort, when the target is null).
 */
export type PlannedSet = HeatSet & {
  planned: true;
  set_type: "working";
  rpe: null;
  deleted_at: null;
  exercise_id: string;
  routine_day_id: string;
  routine_exercise_id: string;
  /** The week's calendar day the set is planned on, `YYYY-MM-DD` in the week's zone. */
  local_date: string;
  /** The set's place in its day: the exercises in position order, each exercise's sets in a run. */
  position: number;
  snapshot: SetSnapshot;
};

const DAYS_PER_WEEK = 7;

/** The seven calendar days of the week that starts on `weekStart`, Monday first. */
export const weekDays = (weekStart: string): string[] => {
  if (!isCalendarDay(weekStart) || daysSinceMonday(weekStart) !== 0) {
    throw new RangeError("A week must start on a Monday, written YYYY-MM-DD");
  }
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => addCalendarDays(weekStart, offset));
};

export const requireTimeZone = (tz: string): void => {
  if (!isValidTimeZone(tz)) {
    throw new RangeError("A week's time zone must be an IANA zone name");
  }
};

/** Refuses an `activeFrom` that is given but is not a calendar day. */
export const requireActiveFrom = (activeFrom: string | undefined): void => {
  if (activeFrom !== undefined && !isCalendarDay(activeFrom)) {
    throw new RangeError("A routine's active date must be a calendar day written YYYY-MM-DD");
  }
};

const isWeekday = (weekday: number): boolean =>
  Number.isInteger(weekday) && weekday >= MIN_WEEKDAY && weekday <= MAX_WEEKDAY;

const isTargetSets = (targetSets: number): boolean =>
  Number.isInteger(targetSets) && targetSets >= MIN_TARGET_SETS && targetSets <= MAX_TARGET_SETS;

const checkRoutine = (routine: PlanRoutine): void => {
  const weekdays = new Set<number>();
  for (const day of routine.days) {
    if (day.weekday === null) {
      continue;
    }
    if (!isWeekday(day.weekday)) {
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

const plannedSetsOfDay = (
  day: PlanRoutineDay & { weekday: number },
  localDate: string,
  performedAt: string,
): PlannedSet[] => {
  const sets: PlannedSet[] = [];
  for (const routineExercise of [...day.exercises].sort(byPosition)) {
    if (routineExercise.exercise.id !== routineExercise.exercise_id) {
      throw new RangeError("A routine exercise's muscle map must be taken from its own exercise");
    }
    if (!isTargetSets(routineExercise.target_sets)) {
      throw new RangeError(
        `A routine exercise's target sets must be a whole number from ${MIN_TARGET_SETS} to ${MAX_TARGET_SETS}`,
      );
    }
    const snapshot = buildSetSnapshot(routineExercise.exercise, routineExercise.muscles);
    for (let count = 0; count < routineExercise.target_sets; count += 1) {
      sets.push({
        planned: true,
        set_type: "working",
        rir: routineExercise.target_rir,
        rpe: null,
        performed_at: performedAt,
        deleted_at: null,
        exercise_id: routineExercise.exercise_id,
        routine_day_id: day.id,
        routine_exercise_id: routineExercise.id,
        local_date: localDate,
        position: sets.length,
        snapshot,
      });
    }
  }
  return sets;
};

/**
 * The planned sets of the week that starts on `weekStart` (a Monday, `YYYY-MM-DD`) in the IANA zone
 * `tz`. Each routine day with a weekday lands on that day of the week, at `params.plannedTime` local
 * (18:00 in v1), and each of its routine exercises becomes `target_sets` working sets at `target_rir`,
 * with a snapshot built by `buildSetSnapshot` from the exercise's current muscle map. A day whose
 * weekday is null means "any day", so it is not placed on the calendar and gives no planned sets. A
 * routine with an `activeFrom` places no set on a day before it, and the day itself is planned.
 *
 * The sets come in weekday order, each day's in exercise position order. The exercise's muscle map is
 * read now, not when the routine was saved, so editing an exercise moves the plan but never a logged
 * set, which keeps its own snapshot.
 *
 * Throws a `RangeError` naming the rule when the week does not start on a Monday, the zone is not an
 * IANA name, `activeFrom` is not a calendar day, two days share a weekday, a weekday or a target is out
 * of range, a routine exercise's map is taken from another exercise, or a muscle map breaks a rule of
 * `buildSetSnapshot`.
 */
export const expandPlan = (
  routine: PlanRoutine,
  weekStart: string,
  tz: string,
  params: CompareParams,
): PlannedSet[] => {
  const days = weekDays(weekStart);
  requireTimeZone(tz);
  checkRoutine(routine);
  requireActiveFrom(routine.activeFrom);
  const { hour, minute } = params.plannedTime;
  return routine.days
    .filter((day): day is PlanRoutineDay & { weekday: number } => day.weekday !== null)
    .sort((first, second) => first.weekday - second.weekday)
    .flatMap((day) => {
      // checkRoutine has held the weekday to 0 to 6, so the week has that day.
      const localDate = days[day.weekday] as string;
      if (routine.activeFrom !== undefined && localDate < routine.activeFrom) {
        return [];
      }
      const performedAt = instantAtLocalTime(localDate, hour, minute, tz).toISOString();
      return plannedSetsOfDay(day, localDate, performedAt);
    });
};
