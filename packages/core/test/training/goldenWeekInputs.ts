import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  setTypeSchema,
} from "../../src/schemas";
import {
  buildSetSnapshot,
  COMPARE_PARAMS_V1,
  compareWeek,
  MUSCLE_IDS,
  muscleState,
  projectWeek,
  targetedMuscles,
} from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { MuscleDetailSet, MuscleId, PlanRoutine } from "../../src/training";

/*
 * The golden week of KEY-353 as inputs for the body map tests: the same routine, sessions and sets the
 * golden test builds, so a body map value is pinned to the numbers the canvas was computed from.
 */

export const GOLDEN_TIME_ZONE = goldenWeek.timeZone;
export const GOLDEN_WEEK_START = goldenWeek.weekStart;
export const params = COMPARE_PARAMS_V1;

const requireExercise = (sourceRef: string) => {
  const exercise = goldenWeek.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error(`The fixture names an exercise it does not hold: ${sourceRef}`);
  }
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: equipmentSchema.parse(exercise.equipment),
    mechanic: exerciseMechanicSchema.parse(exercise.mechanic),
    muscles: exerciseMuscleEntrySchema.array().parse(exercise.muscles),
  };
};

export const routine: PlanRoutine = {
  days: goldenWeek.routine.days.map((day) => ({
    id: day.id,
    position: day.position,
    weekday: day.weekday,
    exercises: day.exercises.map((routineExercise) => {
      const { id, name, equipment, mechanic, muscles } = requireExercise(routineExercise.exercise);
      return {
        id: routineExercise.id,
        position: routineExercise.position,
        exercise_id: id,
        target_sets: routineExercise.targetSets,
        target_rir: routineExercise.targetRir,
        exercise: { id, name, equipment, mechanic },
        muscles,
      };
    }),
  })),
};

const sessions = goldenWeek.sessions.map((session) => ({
  id: session.id,
  local_date: session.localDate,
  routine_day_id: session.routineDayId,
  deleted_at: null,
}));

/** The routine day name of each logged session, which the muscle sheet writes after the date. */
export const sessionDayNames = goldenWeek.sessions.map((session) => ({
  id: session.id,
  routine_day_name:
    goldenWeek.routine.days.find((day) => day.id === session.routineDayId)?.name ?? null,
}));

export const loggedSets: MuscleDetailSet[] = goldenWeek.sets.map((set) => {
  const { id, name, equipment, mechanic, muscles } = requireExercise(set.exercise);
  return {
    session_id: set.sessionId,
    set_type: setTypeSchema.parse(set.setType),
    rir: set.rir,
    rpe: set.rpe,
    performed_at: set.performedAt,
    deleted_at: null,
    snapshot: buildSetSnapshot({ id, name, equipment, mechanic }, muscles),
  };
});

export const targeted = targetedMuscles({ routine });

export const week = projectWeek(
  routine,
  GOLDEN_WEEK_START,
  GOLDEN_TIME_ZONE,
  { sessions, sets: loggedSets },
  params,
);

export const comparison = compareWeek(week.actual, week.projected, params);

/** Thursday 15 October 19:00 in London, the moment of the muscle sheet and list boards. */
export const THURSDAY_EVENING = "2026-10-15T19:00:00+01:00";

/** The heat, ready time and weekly sets of every muscle from the logged sets up to `now`. */
export const actualStateAt = (now: string) =>
  muscleState(loggedSets, now, params.training, targeted);

/** A record of every muscle id, valued by `valueOf`. */
export const recordOfMuscles = <Value>(
  valueOf: (muscle: MuscleId) => Value,
): Record<MuscleId, Value> =>
  // Every id of the list is mapped, so the entries make the full record.
  Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, valueOf(muscle)])) as Record<
    MuscleId,
    Value
  >;
