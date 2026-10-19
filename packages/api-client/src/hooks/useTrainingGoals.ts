import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getCurrentTrainingGoals } from "../repos/trainingGoals";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the signed in user's current training goal, or null when they have not answered the
 * questionnaire. Key `keys.training.goals`. What is cached is the row, kept in the mobile offline cache:
 * the priorities are read from it when a number is worked out, and nothing derived from them is stored.
 * Every training hook that needs the goal's priorities reads it here, so one fetch serves them all.
 * `enabled` false makes no request at all.
 */
export function useTrainingGoals({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.goals,
    queryFn: () => getCurrentTrainingGoals(client),
    enabled,
  });
}
