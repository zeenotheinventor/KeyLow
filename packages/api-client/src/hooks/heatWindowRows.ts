import { TRAINING_PARAMS_V2 } from "@keylow/core/training";

import { keys } from "../queryKeys";

import type { TrainingSet } from "../repos/trainingSchemas";
import type { QueryClient } from "@tanstack/react-query";

// The heat window reaches 14 days back from a moment, so it starts at some hour of the local day 14 days
// back. Reading from the start of the day before that covers it whatever the hour.
export const HEAT_LOOKBACK_DAYS = TRAINING_PARAMS_V2.heatWindowDays + 1;

/**
 * The rows of the newest sets read held in the cache, whatever start day they are keyed by, or undefined
 * when none is. Rows only: the numbers are worked out from them at the current `now` by the hook, and
 * rows from an older day hold every set that could have been logged since on a phone with no connection.
 */
export function newestCachedSetRows(queryClient: QueryClient): TrainingSet[] | undefined {
  // By the time each was read and not by start day: a start day moves back as well as forward when the
  // profile's zone moves west, and the read that is newest in time holds the newest rows.
  const [newest] = queryClient
    .getQueryCache()
    .findAll({ queryKey: keys.training.setsAll })
    .flatMap(({ queryKey }) => {
      const state = queryClient.getQueryState<TrainingSet[]>(queryKey);
      return state?.data === undefined ? [] : [{ rows: state.data, readAt: state.dataUpdatedAt }];
    })
    .sort((first, second) => second.readAt - first.readAt);
  return newest?.rows;
}
