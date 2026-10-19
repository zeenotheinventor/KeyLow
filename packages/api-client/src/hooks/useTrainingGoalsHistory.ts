import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listTrainingGoalsHistory } from "../repos/trainingGoals";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads every goal the signed in user has saved, the current one and the past ones, newest first, since
 * past answers are kept as history. Key `keys.training.goalsHistory`, which the mobile offline cache does
 * not keep: a screen that lists the history reads it with a connection. `enabled` false makes no request.
 */
export function useTrainingGoalsHistory({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.goalsHistory,
    queryFn: () => listTrainingGoalsHistory(client),
    enabled,
  });
}
