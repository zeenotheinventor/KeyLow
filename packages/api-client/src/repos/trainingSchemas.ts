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
import type { PlanRoutine, PlanRoutineDay } from "@keylow/core/training";

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
  started_at: sessionShape.started_at,
  ended_at: sessionShape.ended_at,
  deleted_at: sessionShape.deleted_at,
});

export const SESSION_COLUMNS = Object.keys(sessionColumnsSchema.shape).join(",");

/** A live session of a week with its live sets. Its fields are those of core's `LoggedSession`. */
export type WeekSession = z.output<typeof sessionColumnsSchema> & { sets: TrainingSet[] };

/**
 * The columns of a `workout_sets` row that a session in progress shows and logs against, as PostgREST
 * returns them: those of the sets read with the place in the list and the values entered.
 */
export const sessionSetColumnsSchema = setColumnsSchema.extend({
  position: setShape.position,
  reps: setShape.reps,
  load_kg: setShape.load_kg,
});

export const SESSION_SET_COLUMNS = Object.keys(sessionSetColumnsSchema.shape).join(",");

/** A live set of a session, with its snapshot read. */
export type SessionSet = Omit<z.output<typeof sessionSetColumnsSchema>, "snapshot"> & {
  snapshot: SetSnapshot;
};

/** The columns of a `workout_sessions` row the session bar and the session screen read, as PostgREST returns them. */
export const sessionDetailColumnsSchema = z.object({
  id: sessionShape.id,
  started_at: sessionShape.started_at,
  ended_at: sessionShape.ended_at,
  local_date: sessionShape.local_date,
  routine_day_id: sessionShape.routine_day_id,
  note: sessionShape.note,
  deleted_at: sessionShape.deleted_at,
});

export const SESSION_DETAIL_COLUMNS = Object.keys(sessionDetailColumnsSchema.shape).join(",");

/**
 * A live session with the name of its routine day (null for a free session, or when the day was removed
 * from the routine) and its live sets in the order they are listed. Rows only: nothing here is worked out
 * from the sets, so what is stored on a device is what the database held.
 */
export type SessionWithSets = z.output<typeof sessionDetailColumnsSchema> & {
  routine_day_name: string | null;
  sets: SessionSet[];
};

/** A session row with its routine day and its sets embedded, as PostgREST returns it. The sets are checked one by one. */
export const sessionWithSetsColumnsSchema = sessionDetailColumnsSchema.extend({
  routine_days: z.object({ name: routineDayRowSchema.shape.name }).nullable(),
  workout_sets: z.array(z.unknown()),
});

/** The columns of a `workout_sets` row the "previous" values and the prefill read, with the session's local date embedded. */
export const lastPerformanceRowSchema = z.object({
  id: setShape.id,
  session_id: setShape.session_id,
  position: setShape.position,
  set_type: setShape.set_type,
  reps: setShape.reps,
  load_kg: setShape.load_kg,
  rir: setShape.rir,
  rpe: setShape.rpe,
  performed_at: setShape.performed_at,
  deleted_at: setShape.deleted_at,
  workout_sessions: z.object({ local_date: sessionShape.local_date }),
});

export const LAST_PERFORMANCE_COLUMNS = Object.keys(lastPerformanceRowSchema.shape)
  .filter((column) => column !== "workout_sessions")
  .join(",");

/** One set of an earlier session, with the values a "previous" column shows and a prefill copies. */
export type LastPerformanceSet = Omit<
  z.output<typeof lastPerformanceRowSchema>,
  "session_id" | "workout_sessions"
>;

/** The sets of one earlier session, oldest first. */
export type LastPerformanceSession = {
  session_id: string;
  local_date: string;
  sets: LastPerformanceSet[];
};

/**
 * The active routine as core plans from it. `id` and `name` are the routine's own, and `days` are
 * `PlanRoutine`'s: each exercise carries the exercise it names and that exercise's muscle map as it is
 * now, which `expandPlan` and `targetedMuscles` read. `activatedAt` is the instant the routine was made
 * active, or null when none was recorded (a routine active before the column existed). It is the
 * instant and never a date, since the date depends on the zone: `planRoutineOf` turns it into core's
 * `activeFrom` at read time.
 */
export type ActiveRoutine = Omit<PlanRoutine, "days" | "activeFrom"> & {
  id: string;
  name: string;
  activatedAt: string | null;
  /** Each day with its own name, which the week and the muscle sheet write. */
  days: (PlanRoutineDay & { name: string })[];
};

const dayShape = routineDayRowSchema.shape;
const plannedShape = routineExerciseRowSchema.shape;
const exerciseShape = exerciseRowSchema.shape;

/** The active routine as PostgREST returns it, nested: days, their exercises, each exercise's row and muscles. */
export const routineColumnsSchema = z
  .object({
    id: routineRowSchema.shape.id,
    name: routineRowSchema.shape.name,
    activated_at: routineRowSchema.shape.created_at.nullable(),
    routine_days: z.array(
      z.object({
        id: dayShape.id,
        name: dayShape.name,
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
    activatedAt: routine.activated_at,
    days: routine.routine_days.map((day) => ({
      id: day.id,
      name: day.name,
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
