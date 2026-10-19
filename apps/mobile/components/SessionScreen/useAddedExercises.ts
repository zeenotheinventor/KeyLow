import { keys } from "@keylow/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { ChosenExercise } from "../AddExerciseSheet";
import type { AddedExercise } from "./types";

const NO_ADDED_EXERCISES: readonly AddedExercise[] = [];

/**
 * The exercises added to the session that have no logged set yet, in the order they were added. They are
 * kept in the query cache under a key that is never persisted and never collected, so they survive the screen
 * being hidden and shown again (which unmounts it) and not the app being closed. Nothing fetches them: the
 * read gives back what the cache holds, so an invalidation of the training reads leaves them be.
 */
export function useAddedExercises(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = keys.training.addedExercises(sessionId ?? "");
  const { data: added } = useQuery({
    queryKey,
    queryFn: () =>
      queryClient.getQueryData<readonly AddedExercise[]>(queryKey) ?? NO_ADDED_EXERCISES,
    initialData: NO_ADDED_EXERCISES,
    enabled: sessionId !== undefined,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const add = useCallback(
    ({ id, name, equipment }: ChosenExercise) => {
      if (sessionId === undefined) {
        return;
      }
      queryClient.setQueryData<readonly AddedExercise[]>(
        keys.training.addedExercises(sessionId),
        (current = NO_ADDED_EXERCISES) =>
          current.some((entry) => entry.id === id)
            ? current
            : [...current, { id, name, equipment }],
      );
    },
    [queryClient, sessionId],
  );

  return { added: sessionId === undefined ? NO_ADDED_EXERCISES : added, add };
}
