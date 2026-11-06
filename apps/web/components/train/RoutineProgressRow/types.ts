import type { RoutineProgressExercise } from "@keylow/api-client";

export type RoutineProgressRowProps = Omit<RoutineProgressExercise, "exerciseId"> & {
  /** Where the row goes: the exercise's progress page. The row is plain information without it. */
  href?: string | undefined;
};
