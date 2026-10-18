import {
  exerciseMuscleEntrySchema,
  exerciseRowSchema,
  routineDayRowSchema,
  routineExerciseRowSchema,
  routineRowSchema,
  workoutSessionRowSchema,
  workoutSetRowSchema,
} from "@keylow/core/schemas";
import { z } from "zod";

import type { SetSnapshot } from "@keylow/core/schemas";
import type { PlanRoutine } from "@keylow/core/training";

// The bounds are core's: each field here is the field of the row schema in core, so a bound that moves
// there moves here. The row schemas are refined (a set has one effort measure at most, a snapshot is
// taken from the set's exercise), and a refined schema cannot be picked from, hence the `shape` fields.

const setShape = workoutSetRowSchema.shape;

/**
 * The columns of a `workout_sets` row that heat and volume read, as PostgREST returns them. The load and
 * the reps are not read: nothing in the model uses them, and the less a stored row holds, the less is
 * kept on a device. The snapshot is checked by core's `parseSetSnapshot`, which tells an unknown
 * version from a broken shape, so it passes through here untouched.
 */
export const setColumnsSchema = z.object({
  id: setShape.id,
  session_id: setShape.session_id,
  exercise_id: setShape.exercise_id,
  set_type: setShape.set_type,
  rir: setShape.rir,
  rpe: setShape.rpe,
  performed_at: setShape.performed_at,
  snapshot: z.unknown(),
  deleted_at: setShape.deleted_at,
});

export const SET_COLUMNS = Object.keys(setColumnsSchema.shape).join(",");

/** A live set of a logged session, with its snapshot read. Core's `muscleState` and `projectWeek` take it as it is. */
export type TrainingSet = Omit<z.output<typeof setColumnsSchema>, "snapshot"> & {
  snapshot: SetSnapshot;
};

const sessionShape = workoutSessionRowSchema.shape;

/** The columns of a `workout_sessions` row the week comparison reads, as PostgREST returns them. */
export const sessionColumnsSchema = z.object({
  id: sessionShape.id,
  local_date: sessionShape.local_date,
  routine_day_id: sessionShape.routine_day_id,
  deleted_at: sessionShape.deleted_at,
});

export const SESSION_COLUMNS = Object.keys(sessionColumnsSchema.shape).join(",");

/** A live session of a week with its live sets. Its fields are those of core's `LoggedSession`. */
export type WeekSession = z.output<typeof sessionColumnsSchema> & { sets: TrainingSet[] };

/**
 * The active routine as core plans from it. `id` and `name` are the routine's own, and `days` are
 * `PlanRoutine`'s: each exercise carries the exercise it names and that exercise's muscle map as it is
 * now, which `expandPlan` and `targetedMuscles` read.
 */
export type ActiveRoutine = PlanRoutine & { id: string; name: string };

const dayShape = routineDayRowSchema.shape;
const plannedShape = routineExerciseRowSchema.shape;
const exerciseShape = exerciseRowSchema.shape;

/** The active routine as PostgREST returns it, nested: days, their exercises, each exercise's row and muscles. */
export const routineColumnsSchema = z
  .object({
    id: routineRowSchema.shape.id,
    name: routineRowSchema.shape.name,
    routine_days: z.array(
      z.object({
        id: dayShape.id,
        position: dayShape.position,
        weekday: dayShape.weekday,
        routine_exercises: z.array(
          z.object({
            id: plannedShape.id,
            position: plannedShape.position,
            exercise_id: plannedShape.exercise_id,
            target_sets: plannedShape.target_sets,
            target_rir: plannedShape.target_rir,
            exercises: z.object({
              id: exerciseShape.id,
              name: exerciseShape.name,
              equipment: exerciseShape.equipment,
              mechanic: exerciseShape.mechanic,
              exercise_muscles: z.array(exerciseMuscleEntrySchema),
            }),
          }),
        ),
      }),
    ),
  })
  .transform((routine): ActiveRoutine => ({
    id: routine.id,
    name: routine.name,
    days: routine.routine_days.map((day) => ({
      id: day.id,
      position: day.position,
      weekday: day.weekday,
      exercises: day.routine_exercises.map(({ exercises, ...planned }) => ({
        ...planned,
        exercise: {
          id: exercises.id,
          name: exercises.name,
          equipment: exercises.equipment,
          mechanic: exercises.mechanic,
        },
        muscles: exercises.exercise_muscles,
      })),
    })),
  }));
