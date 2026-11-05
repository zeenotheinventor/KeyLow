import { useExerciseMuscles as useExerciseMusclesOf } from "@keylow/api-client";

import { useIsOnline } from "../../lib/connectivity";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { ExerciseMusclesState } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

export type { ExerciseMusclesState };

/**
 * The muscle map of an exercise for the sheet, as the hook of `@keylow/api-client` has it, with the reads
 * allowed once the Terms are accepted and the phone's own word on whether it is online.
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
  return useExerciseMusclesOf({
    exerciseId,
    known,
    isOpen,
    isOnline: useIsOnline(),
    enabled: useReadsEnabled(),
  });
}
