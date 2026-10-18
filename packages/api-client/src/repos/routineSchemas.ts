import {
  exerciseRowSchema,
  routineDayRowSchema,
  routineExerciseRowSchema,
  routineRowSchema,
} from "@keylow/core/schemas";
import { z } from "zod";

// The bounds are core's: each field here is the field of the row schema in core, so a bound that moves
// there moves here. `activated_at` is the one column core's routine row does not know yet.

const routineShape = routineRowSchema.shape;
const dayShape = routineDayRowSchema.shape;
const plannedShape = routineExerciseRowSchema.shape;
const exerciseShape = exerciseRowSchema.shape;

const routineColumns = {
  id: routineShape.id,
  name: routineShape.name,
  is_active: routineShape.is_active,
  is_archived: routineShape.is_archived,
  /** The moment the routine last became the active one, or null before its first activation. Set by a trigger. */
  activated_at: routineShape.created_at.nullable(),
};

/** The columns of a `routines` row a screen shows: its name, its flags and when it was last activated. */
export const routineRecordSchema = z.object(routineColumns);

export const ROUTINE_RECORD_COLUMNS = Object.keys(routineColumns).join(",");

/** A routine as stored, without its days. What archiving and restoring resolve to. */
export type RoutineRecord = z.output<typeof routineRecordSchema>;

const dayColumns = {
  id: dayShape.id,
  position: dayShape.position,
  weekday: dayShape.weekday,
  name: dayShape.name,
};

const DAY_COLUMNS = Object.keys(dayColumns).join(",");

/** A routine of the library as PostgREST returns it: its days and the sets of each day's exercises, nested. */
export const routineListRowSchema = z
  .object({
    ...routineColumns,
    routine_days: z.array(
      z.object({
        ...dayColumns,
        routine_exercises: z.array(z.object({ target_sets: plannedShape.target_sets })),
      }),
    ),
  })
  .transform(({ routine_days, ...routine }) => ({
    ...routine,
    days: routine_days.map(({ routine_exercises, ...day }) => ({
      ...day,
      exercises: routine_exercises,
    })),
  }));

/**
 * A routine of the library as stored: its flags, its days in order and the sets planned for each day's
 * exercises. Rows only. The summary a card shows is worked out from them by `summariseRoutine` at read
 * time, so it is never stale.
 */
export type RoutineListEntry = z.output<typeof routineListRowSchema>;

export const ROUTINE_LIST_SELECT = `${ROUTINE_RECORD_COLUMNS},routine_days(${DAY_COLUMNS},routine_exercises(target_sets))`;

const plannedColumns = {
  id: plannedShape.id,
  position: plannedShape.position,
  exercise_id: plannedShape.exercise_id,
  target_sets: plannedShape.target_sets,
  rep_min: plannedShape.rep_min,
  rep_max: plannedShape.rep_max,
  target_rir: plannedShape.target_rir,
};

const PLANNED_COLUMNS = Object.keys(plannedColumns).join(",");

/** A routine as PostgREST returns it for the editor: days, their exercises, and each exercise's name, equipment and id. */
export const routineDetailRowSchema = z
  .object({
    ...routineColumns,
    routine_days: z.array(
      z.object({
        ...dayColumns,
        routine_exercises: z.array(
          z.object({
            ...plannedColumns,
            exercises: z.object({
              id: exerciseShape.id,
              name: exerciseShape.name,
              equipment: exerciseShape.equipment,
            }),
          }),
        ),
      }),
    ),
  })
  .transform(({ routine_days, ...routine }) => ({
    ...routine,
    days: routine_days.map(({ routine_exercises, ...day }) => ({
      ...day,
      exercises: routine_exercises.map(({ exercises, ...planned }) => ({
        ...planned,
        exercise: exercises,
      })),
    })),
  }));

/**
 * A routine as stored, for the editor: its days in position order, each with its exercises in position
 * order. Each exercise carries the exercise it names (id, name, equipment) and not its muscle map.
 */
export type RoutineDetail = z.output<typeof routineDetailRowSchema>;

export const ROUTINE_DETAIL_SELECT = `${ROUTINE_RECORD_COLUMNS},routine_days(${DAY_COLUMNS},routine_exercises(${PLANNED_COLUMNS},exercises(id,name,equipment)))`;
