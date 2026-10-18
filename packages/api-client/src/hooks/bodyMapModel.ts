import {
  COMPARE_PARAMS_V1,
  MUSCLE_IDS,
  TRAINING_PARAMS_V1,
  compareWeek,
  compareWeekSoFar,
  dayMoments,
  gapValues,
  heatValues,
  muscleDetail,
  muscleState,
  projectWeek,
  projectedState,
  targetedMuscles,
  volumeValues,
  weekPlanDays,
} from "@keylow/core/training";

import { planRoutineOf } from "./planRoutineOf";

import type { ActiveRoutine, TrainingSet, WeekSession } from "../repos/trainingSchemas";
import type {
  BodyMapView,
  DayMoments,
  MuscleDetail,
  MuscleId,
  MusclePlanComparison,
  MuscleState,
  PlanRoutine,
  TargetedMusclesInput,
  WeekPlan,
  WeekProjection,
} from "@keylow/core/training";

/*
 * The body map as a composition of core: every number comes from a core function over the cached rows,
 * so nothing here does maths of its own. The moments the rows are read at are arguments, so nothing
 * reads the clock.
 */

/** The cached rows a body map number is worked out from. */
export type BodyMapRows = {
  /** The user's IANA time zone. */
  timeZone: string;
  /** The active routine, or null when there is none. */
  routine: ActiveRoutine | null;
  /** The live sets from the start of the heat window of the week through today. */
  sets: readonly TrainingSet[];
  /** The live sessions of the week with their sets. */
  sessions: readonly WeekSession[];
};

/** Where on the week a body map reads: the week, the current moment and the scrubber day picked, if any. */
export type BodyMapMoment = {
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** The current moment, an ISO timestamp with a zone. */
  now: string;
  /** The scrubber day picked, `YYYY-MM-DD`, or undefined for the current moment. */
  at?: string | undefined;
};

const NO_ROUTINE: PlanRoutine = { days: [] };

/**
 * What decides which muscles are targeted. The goal's muscle priority joins here when the goal read
 * exists (`targetedMuscles` takes it as `priority`), so every body map number gets it from this one place.
 */
export const targetedInputOf = (routine: ActiveRoutine | null): TargetedMusclesInput => ({
  routine,
});

/** The muscles the plan trains (and the goal, once `targetedInputOf` passes it). */
export const targetedMusclesOf = (routine: ActiveRoutine | null): ReadonlySet<MuscleId> =>
  targetedMuscles(targetedInputOf(routine));

/** The seven days of the week, and the moment the body map reads at: `now`, or the instant of the day picked. */
export function momentOf({ weekStart, now, at }: BodyMapMoment, timeZone: string) {
  const moments: DayMoments = dayMoments({ weekStart, tz: timeZone, now });
  if (at === undefined) {
    return { moments, computedAt: now };
  }
  const day = moments.days.find(({ date }) => date === at);
  if (day === undefined) {
    throw new RangeError("The scrubber day must be a day of the week");
  }
  return { moments, computedAt: day.at };
}

function projectionOf(rows: BodyMapRows, weekStart: string): WeekProjection {
  return projectWeek(
    planRoutineOf(rows.routine, rows.timeZone) ?? NO_ROUTINE,
    weekStart,
    rows.timeZone,
    { sessions: rows.sessions, sets: rows.sessions.flatMap((session) => session.sets) },
    COMPARE_PARAMS_V1,
  );
}

/**
 * Every logged set the projection does not already hold: the sets from before the week, and those of a
 * session that follows no routine day, which the plan does not replace. Projected counts them as it counts
 * what the plan replaced, so a session logged today shows in both views (ruling D). A set is told by its id,
 * since the rows of the heat window and of the week are read apart.
 */
function loggedOutsideProjection(rows: BodyMapRows, projection: WeekProjection): TrainingSet[] {
  const projectedObjects = new Set<object>(projection.projected);
  const weekSets = rows.sessions.flatMap((session) => session.sets);
  const idsInProjection = new Set(
    weekSets.filter((set) => projectedObjects.has(set)).map((set) => set.id),
  );
  const byId = new Map([...rows.sets, ...weekSets].map((set) => [set.id, set]));
  return [...byId.values()].filter((set) => !idsInProjection.has(set.id));
}

/**
 * Each muscle's heat and ready time at `computedAt`. Actual is what was logged. Projected assumes the
 * plan was followed until then, with what was logged in its place, and every other logged set as well
 * (see `loggedOutsideProjection`). With no routine there is no plan
 * to follow, so Projected is Actual.
 */
export function heatStatesOf(
  rows: BodyMapRows,
  view: BodyMapView,
  weekStart: string,
  computedAt: string,
): Record<MuscleId, MuscleState> {
  const targeted = targetedMusclesOf(rows.routine);
  if (view === "actual" || rows.routine === null) {
    return muscleState(rows.sets, computedAt, TRAINING_PARAMS_V1, targeted);
  }
  const projection = projectionOf(rows, weekStart);
  return projectedState(
    [...projection.projected, ...loggedOutsideProjection(rows, projection)],
    computedAt,
    rows.timeZone,
    COMPARE_PARAMS_V1,
    targeted,
  );
}

/**
 * Each muscle's place against the plan so far: the status from the plan up to yesterday plus today once
 * it is logged (`compareWeekSoFar`, ruling G), and whether the muscle is in the plan from the whole week
 * (`compareWeek`). A muscle whose only planned session is still ahead has nothing planned so far, and
 * would read as not in the plan until that day if the so-far numbers decided it.
 */
function gapValuesOf(rows: BodyMapRows, weekStart: string, computedAt: string) {
  const projection = projectionOf(rows, weekStart);
  const soFar = compareWeekSoFar(projection, computedAt, rows.timeZone, COMPARE_PARAMS_V1);
  const wholeWeek = compareWeek(projection.actual, projection.projected, COMPARE_PARAMS_V1);
  const inPlanFromWholeWeek: Record<MuscleId, MusclePlanComparison> = { ...soFar };
  for (const muscle of MUSCLE_IDS) {
    inPlanFromWholeWeek[muscle] = {
      ...soFar[muscle],
      projectedWeeklySets: wholeWeek[muscle].projectedWeeklySets,
    };
  }
  return gapValues(inPlanFromWholeWeek, targetedMusclesOf(rows.routine));
}

/** The values of one scale. Heat reads at `computedAt`, volume the calendar week, and gap the week so far. */
export function valuesOf(
  scale: "heat" | "volume" | "gap",
  view: BodyMapView,
  rows: BodyMapRows,
  weekStart: string,
  computedAt: string,
): Record<MuscleId, number> {
  switch (scale) {
    case "heat":
      return heatValues(heatStatesOf(rows, view, weekStart, computedAt));
    case "volume": {
      const { actual, projected } = projectionOf(rows, weekStart);
      return volumeValues(
        compareWeek(actual, projected, COMPARE_PARAMS_V1),
        targetedMusclesOf(rows.routine),
        // With no routine there is no plan to project, so Projected is Actual.
        rows.routine === null ? "actual" : view,
      );
    }
    case "gap":
      return gapValuesOf(rows, weekStart, computedAt);
  }
}

const MILLISECONDS_PER_DAY = 24 * 3_600_000;

/** True when no set was performed in the heat window that ends at `computedAt`, the start not included. */
export function nothingLoggedAt(sets: readonly TrainingSet[], computedAt: string): boolean {
  const end = Date.parse(computedAt);
  const start = end - TRAINING_PARAMS_V1.heatWindowDays * MILLISECONDS_PER_DAY;
  return !sets.some((set) => {
    const performedAt = Date.parse(set.performed_at);
    return performedAt > start && performedAt <= end;
  });
}

/** The week as the scrubber and the Train home draw it, read at the current moment. */
export function weekPlanOf(rows: BodyMapRows, weekStart: string, now: string): WeekPlan {
  return weekPlanDays({
    routine: planRoutineOf(rows.routine, rows.timeZone),
    sessions: rows.sessions,
    now,
    tz: rows.timeZone,
    weekStart,
  });
}

/**
 * What the muscle sheet shows for one muscle at `computedAt`. The routine day of a session is named from
 * the active routine, for the sessions of this week. A set from an earlier week has no session row in the
 * cache, so its day is told by no name.
 */
export function muscleDetailOf(
  muscle: MuscleId,
  view: BodyMapView,
  rows: BodyMapRows,
  weekStart: string,
  computedAt: string,
): MuscleDetail {
  const projection = projectionOf(rows, weekStart);
  const dayNames = new Map((rows.routine?.days ?? []).map((day) => [day.id, day.name]));
  return muscleDetail({
    muscle,
    state: heatStatesOf(rows, view, weekStart, computedAt),
    comparison: compareWeek(projection.actual, projection.projected, COMPARE_PARAMS_V1),
    sets: rows.sets,
    sessions: rows.sessions.map(({ id, routine_day_id }) => ({
      id,
      routine_day_name: routine_day_id === null ? null : (dayNames.get(routine_day_id) ?? null),
    })),
    targeted: targetedInputOf(rows.routine),
    // With no routine there is no plan to project, so Projected is Actual.
    view: rows.routine === null ? "actual" : view,
    now: computedAt,
    tz: rows.timeZone,
    params: COMPARE_PARAMS_V1,
  });
}
