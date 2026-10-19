import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { saveTrainingGoals } from "../repos/trainingGoals";
import { refreshTraining } from "../routineCache";
import { useSingleFlight } from "./useSingleFlight";

import type { GoalAnswers } from "@keylow/core/training";

/**
 * Saves the questionnaire's answers as the new current goal and resolves to the new row as stored. The
 * priorities and the presets version are worked out by core, never taken from the caller. It is one call
 * to the database, which closes the current row and keeps it as history, and is tried once more when
 * another save got there first. Answers the questionnaire would refuse throw a `RangeError` before any
 * request. Needs a connection: there is no offline queue, and nothing is replayed from storage.
 *
 * The hook is not re-entrant: a second press of Save with the same answers while the first is pending
 * joins it and resolves to the same row. Different answers are a different edit and run after the
 * pending save settles, so the last save wins.
 *
 * The new row replaces the cached current goal, and every training query is marked stale after: the goal
 * history, and everything that reads the goal's priorities (heat, the week, the body map), so they are
 * worked out again. A save the database or the network failed marks the goal stale, since another device may have changed it.
 */
export function useSaveTrainingGoals() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const saveOnce = useSingleFlight((answers: GoalAnswers) => saveTrainingGoals(client, answers));

  return useMutation({
    mutationFn: saveOnce,
    onSuccess: (goals) => {
      queryClient.setQueryData(keys.training.goals, goals);
      refreshTraining(queryClient);
    },
    onError: (error) => {
      // Answers refused before any request changed nothing, so there is nothing to read again.
      if (!(error instanceof RangeError)) {
        void queryClient.invalidateQueries({ queryKey: keys.training.goals });
      }
    },
  });
}
