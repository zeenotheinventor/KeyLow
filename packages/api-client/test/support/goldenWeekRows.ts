import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  setTypeSchema,
} from "@keylow/core/schemas";
import { buildSetSnapshot } from "@keylow/core/training";

import { ROUTINE_ID, setRow } from "./training";
import goldenWeek from "../../../core/test/fixtures/training/goldenWeek.json";

/*
 * The golden week of KEY-353 (Push Pull Legs, Monday 12 to Sunday 18 October 2026 in London) as the rows
 * PostgREST returns, so a hook is tested on the same sessions and sets the core body map tests pin their
 * numbers to. Only the shape is converted here: every number a test expects is written out as a literal.
 */

export const GOLDEN_WEEK_START = goldenWeek.weekStart;
export const GOLDEN_TIME_ZONE = goldenWeek.timeZone;

const requireExercise = (sourceRef: string) => {
  const exercise = goldenWeek.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (exercise === undefined) {
    throw new Error(`The golden week names an exercise it does not hold: ${sourceRef}`);
  }
  return {
    id: exercise.id,
    name: exercise.name,
    equipment: equipmentSchema.parse(exercise.equipment),
    mechanic: exerciseMechanicSchema.parse(exercise.mechanic),
    muscles: exerciseMuscleEntrySchema.array().parse(exercise.muscles),
  };
};

const goldenSetRows = goldenWeek.sets.map((set) => {
  const { id, name, equipment, mechanic, muscles } = requireExercise(set.exercise);
  return setRow({
    session_id: set.sessionId,
    exercise_id: id,
    set_type: setTypeSchema.parse(set.setType),
    rir: set.rir,
    rpe: set.rpe,
    performed_at: set.performedAt,
    snapshot: buildSetSnapshot({ id, name, equipment, mechanic }, muscles),
  });
});

/** The live sets of the week, as the sets read returns them. */
export const goldenSets = goldenSetRows;

/** The three sessions of the week with their sets, as the week read returns them. */
export const goldenSessions = goldenWeek.sessions.map((session) => ({
  id: session.id,
  local_date: session.localDate,
  routine_day_id: session.routineDayId,
  started_at: session.startedAt,
  ended_at: session.endedAt,
  deleted_at: null,
  workout_sets: goldenSetRows.filter((set) => set.session_id === session.id),
}));

/** The active routine of the week, as the routine read returns it. */
export const goldenRoutine = {
  id: ROUTINE_ID,
  name: goldenWeek.routine.name,
  activated_at: null,
  routine_days: goldenWeek.routine.days.map((day) => ({
    id: day.id,
    name: day.name,
    position: day.position,
    weekday: day.weekday,
    routine_exercises: day.exercises.map((routineExercise) => {
      const { id, name, equipment, mechanic, muscles } = requireExercise(routineExercise.exercise);
      return {
        id: routineExercise.id,
        position: routineExercise.position,
        exercise_id: id,
        target_sets: routineExercise.targetSets,
        target_rir: routineExercise.targetRir,
        exercises: { id, name, equipment, mechanic, exercise_muscles: muscles },
      };
    }),
  })),
};

/** What `installTrainingFake` takes for the golden week. */
export const goldenWeekData = {
  sets: goldenSets,
  sessions: goldenSessions,
  routine: goldenRoutine,
  timeZone: GOLDEN_TIME_ZONE,
};
