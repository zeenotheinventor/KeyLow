import type { RoutineDraft } from "./routineDraft";

/*
 * What `save_routine(p_routine_id, p_routine, p_days)` reads (the header comment of the function in
 * 20261018130000_training_sessions_routines_goals.sql). Each key is picked by name, so a draft built from
 * stored rows never sends the ones the function ignores (user_id, routine_id, position, is_active,
 * is_archived, created_at, routine_day_id), and a position is the index in the array it is sent in.
 */

export type RoutinePayload = Readonly<{
  p_routine: Readonly<{ name: string }>;
  p_days: readonly Readonly<{
    /** The id of the stored day this one updates in place, or null for a new day. */
    id: string | null;
    weekday: number | null;
    name: string;
    exercises: readonly Readonly<{
      exercise_id: string;
      target_sets: number;
      rep_min: number;
      rep_max: number;
      target_rir: number | null;
    }>[];
  }>[];
}>;

/**
 * The two JSON arguments of `save_routine` for a draft. It takes the cleaned draft that
 * `validateRoutineDraft` returns, so the names are already trimmed and every bound has been checked.
 * A day keeps its id when it has one, so the sessions logged from it stay linked after the edit.
 */
export const routinePayload = (draft: RoutineDraft): RoutinePayload => ({
  p_routine: { name: draft.name },
  p_days: draft.days.map((day) => ({
    id: day.id,
    weekday: day.weekday,
    name: day.name,
    exercises: day.exercises.map((exercise) => ({
      exercise_id: exercise.exercise_id,
      target_sets: exercise.target_sets,
      rep_min: exercise.rep_min,
      rep_max: exercise.rep_max,
      target_rir: exercise.target_rir,
    })),
  })),
});
