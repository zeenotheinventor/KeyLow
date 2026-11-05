import { useExercise } from "./useExercise";

import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

/**
 * What the Muscles it works sheet or dialog has of an exercise's map: the map itself, still being read, not
 * readable because the device is offline and holds no copy, or not readable because the read failed or the
 * exercise is gone.
 */
export type ExerciseMusclesState =
  | { status: "ready"; muscles: readonly ExerciseMuscleEntry[] }
  | { status: "loading" }
  | { status: "offline" }
  | { status: "failed" };

/**
 * The muscle map of an exercise for the sheet or dialog. The map the screen already holds (`known`) is used
 * as it is, with no request. Otherwise the server is asked, and only while the sheet is open, since the read
 * is not kept on the device and needs a connection. The caller says whether reads are `enabled` and whether
 * the device `isOnline`, since each app knows that its own way.
 */
export function useExerciseMuscles({
  exerciseId,
  known,
  isOpen,
  isOnline,
  enabled,
}: {
  exerciseId: string;
  known: readonly ExerciseMuscleEntry[] | null;
  isOpen: boolean;
  isOnline: boolean;
  enabled: boolean;
}): ExerciseMusclesState {
  const exercise = useExercise(known === null && isOpen ? exerciseId : undefined, { enabled });

  if (known !== null) {
    return { status: "ready", muscles: known };
  }
  switch (exercise.status) {
    case "ready":
      return { status: "ready", muscles: exercise.exercise.muscles };
    case "error":
    case "notFound":
      return { status: "failed" };
    case "loading":
      return isOpen && !isOnline ? { status: "offline" } : { status: "loading" };
  }
}
