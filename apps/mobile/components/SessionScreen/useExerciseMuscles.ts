import { useExercise } from "@keylow/api-client";

import { useIsOnline } from "../../lib/connectivity";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

/**
 * What the muscles sheet has of an exercise's map: the map itself, still being read, not readable because
 * the phone is offline and holds no copy, or not readable because the read failed or the exercise is gone.
 */
export type ExerciseMusclesState =
  | { status: "ready"; muscles: readonly ExerciseMuscleEntry[] }
  | { status: "loading" }
  | { status: "offline" }
  | { status: "failed" };

/**
 * The muscle map of an exercise for the sheet. The map the phone already holds (`known`) is used as it is,
 * with no request. Otherwise the server is asked, and only while the sheet is open, since the read is not
 * kept on the phone and needs a connection.
 */
export function useExerciseMuscles({
  exerciseId,
  known,
  isOpen,
}: {
  exerciseId: string;
  known: readonly ExerciseMuscleEntry[] | null;
  isOpen: boolean;
}): ExerciseMusclesState {
  const enabled = useReadsEnabled();
  const isOnline = useIsOnline();
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
