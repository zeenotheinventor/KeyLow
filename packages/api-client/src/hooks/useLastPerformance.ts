import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getLastPerformance } from "../repos/trainingSessions";

import type { DiaryReadOptions } from "./DiaryReadOptions";

export type UseLastPerformanceOptions = DiaryReadOptions & {
  /** The session being logged, which is left out of the sets read. */
  excludeSessionId?: string | undefined;
};

/**
 * Loads the working sets of one exercise from its two latest earlier sessions, newest first, for the
 * "previous" values of a set and the prefill. Key `keys.training.lastPerformance(exerciseId,
 * excludeSessionId)`. It is not kept in the mobile cache: it is only read while logging, which needs a
 * connection.
 *
 * Nothing is asked while `exerciseId` is undefined. `enabled` false makes no request at all.
 */
export function useLastPerformance(
  exerciseId: string | undefined,
  { enabled = true, excludeSessionId }: UseLastPerformanceOptions = {},
) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.lastPerformance(exerciseId ?? "", excludeSessionId),
    queryFn:
      exerciseId === undefined
        ? skipToken
        : () => getLastPerformance(client, exerciseId, { excludeSessionId, sessions: 2 }),
    enabled,
  });
}
