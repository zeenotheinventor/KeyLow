import type { RoutineProgressDayItem } from "@keylow/api-client";

// What the section is made of is api-client's, where the hook that reads it lives. The phone and the web draw it.
export type {
  RoutineProgressDayItem,
  RoutineProgressExercise,
  RoutineProgressState,
} from "@keylow/api-client";

export type RoutineProgressDayProps = {
  day: RoutineProgressDayItem;
  /** Opens an exercise's graph by its id. The rows are plain information without it. */
  onOpenExercise?: ((exerciseId: string) => void) | undefined;
};
