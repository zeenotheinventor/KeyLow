import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { keys } from "../queryKeys";
import { getRoutine } from "../repos/routines";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { RoutineDetail } from "../repos/routineSchemas";

/**
 * Loads one routine of the signed in user with its days in order and each day's exercises in order, or
 * null when it does not exist or is not theirs. Key `keys.training.routine(id)`. The query holds rows
 * only and is kept in the mobile cache, so the editor opens a routine without a connection.
 *
 * An `id` that is not a UUID fails at once without a request, and is not retried. Any other failure is
 * retried, as the connection may come back.
 *
 * Nothing is asked while `id` is undefined. `enabled` false makes no request at all.
 */
export function useRoutine(id: string | undefined, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery<RoutineDetail | null>({
    queryKey: keys.training.routine(id ?? ""),
    queryFn: id === undefined ? skipToken : () => getRoutine(client, id),
    enabled,
    retry: retryUnlessRangeError,
  });
}
