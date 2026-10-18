import type { RoutineExerciseRow } from "../schemas/training";

/** A routine exercise as the scaffold reads it. A stored `routine_exercises` row fits. */
export type ScaffoldRoutineExercise = Pick<
  RoutineExerciseRow,
  "position" | "exercise_id" | "target_sets" | "rep_min" | "rep_max" | "target_rir"
>;

/** A routine day as the scaffold reads it. A stored day with its exercises fits. */
export type ScaffoldRoutineDay = Readonly<{
  id: string;
  exercises: readonly ScaffoldRoutineExercise[];
}>;

/** One exercise of the session's starting plan. */
export type ScaffoldedExercise = Readonly<{
  exercise_id: string;
  /** The sets the routine plans for it: how many rows to draw for the person to fill in. */
  slots: number;
  rep_min: number;
  rep_max: number;
  /** Null means the routine sets no target. */
  target_rir: number | null;
}>;

export type SessionScaffold = Readonly<{
  /** The link a session started from this day carries (`workout_sessions.routine_day_id`). */
  routine_day_id: string;
  /** In the day's position order. */
  exercises: readonly ScaffoldedExercise[];
}>;

/**
 * The starting plan of a session started from a routine day: the day's exercises in position order, each
 * with as many slots as it has target sets, its rep range and its target RIR, and the day's id. It plans
 * only: no set exists until one is logged.
 */
export const scaffoldSession = (day: ScaffoldRoutineDay): SessionScaffold => ({
  routine_day_id: day.id,
  exercises: [...day.exercises]
    .sort((first, second) => first.position - second.position)
    .map((exercise) => ({
      exercise_id: exercise.exercise_id,
      slots: exercise.target_sets,
      rep_min: exercise.rep_min,
      rep_max: exercise.rep_max,
      target_rir: exercise.target_rir,
    })),
});
