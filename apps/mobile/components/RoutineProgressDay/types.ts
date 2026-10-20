import type { RoutineProgressRowProps } from "../RoutineProgressRow";

/** An exercise of a routine day: its id, which the graph is opened by, and what its row says. */
export type RoutineProgressExercise = Omit<RoutineProgressRowProps, "onPress"> & {
  exerciseId: string;
};

/** A routine day with the progress of its exercises, in the routine's order. */
export type RoutineProgressDayItem = {
  id: string;
  name: string;
  exercises: readonly RoutineProgressExercise[];
};

export type RoutineProgressDayProps = {
  day: RoutineProgressDayItem;
  /** Opens an exercise's graph by its id. The rows are plain information without it. */
  onOpenExercise?: ((exerciseId: string) => void) | undefined;
};

/**
 * What the Progress section shows: its routine days, or while they are read a loading state, or a failed
 * one with its retry.
 */
export type RoutineProgressState =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; days: readonly RoutineProgressDayItem[] };
