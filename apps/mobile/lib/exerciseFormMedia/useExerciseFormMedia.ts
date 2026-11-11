import { useExerciseFormMedia as useExerciseFormMediaOf } from "@keylow/api-client";

import { useIsOnline } from "../connectivity";
import { useReadsEnabled } from "../useReadsEnabled";

import type { ExerciseFormMediaState } from "@keylow/api-client";

export type { ExerciseFormMediaState };

/**
 * The form media of an exercise for the sheets that show it, as the hook of `@keylow/api-client` has it,
 * with the reads allowed once the Terms are accepted and the phone's own word on whether it is online.
 * Nothing is read while `isOpen` is false.
 */
export function useExerciseFormMedia({
  exerciseId,
  isOpen,
}: {
  exerciseId: string;
  isOpen: boolean;
}): ExerciseFormMediaState {
  return useExerciseFormMediaOf({
    exerciseId,
    isOpen,
    isOnline: useIsOnline(),
    enabled: useReadsEnabled(),
  });
}
