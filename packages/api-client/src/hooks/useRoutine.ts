import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getRoutine } from "../repos/routines";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads one routine of the signed in user with its days in order and each day's exercises in order, or
 * null when it does not exist or is not theirs. Key `keys.training.routine(id)`. The query holds rows
 * only and is kept in the mobile cache, so the editor opens a routine without a connection.
 *
 * Nothing is asked while `id` is undefined. `enabled` false makes no request at all.
 */
export function useRoutine(id: string | undefined, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.routine(id ?? ""),
    queryFn: id === undefined ? skipToken : () => getRoutine(client, id),
    enabled,
  });
}
