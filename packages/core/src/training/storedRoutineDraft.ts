import type { ExerciseNames } from "./editorExercise";
import type { RoutineDraft } from "./routineDraft";

/** A stored routine as the editors read it: the days in order, and each day's exercises with the exercise they name. */
export type StoredRoutineForEditing = Readonly<{
  name: string;
  days: readonly Readonly<{
    id: string;
    weekday: number | null;
    name: string;
    exercises: readonly Readonly<{
      exercise_id: string;
      target_sets: number;
      rep_min: number;
      rep_max: number;
      target_rir: number | null;
      exercise: Readonly<{ name: string }>;
    }>[];
  }>[];
}>;

/** A stored routine as the editor's draft: the days and exercises in order, with only the columns the draft holds. */
export const draftOfStoredRoutine = (routine: StoredRoutineForEditing): RoutineDraft => ({
  name: routine.name,
  days: routine.days.map((day) => ({
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

/** The names of a stored routine's exercises, by exercise id, which the draft does not hold. */
export const exerciseNamesOfStoredRoutine = (routine: StoredRoutineForEditing): ExerciseNames =>
  Object.fromEntries(
    routine.days.flatMap((day) =>
      day.exercises.map((exercise) => [exercise.exercise_id, exercise.exercise.name]),
    ),
  );
