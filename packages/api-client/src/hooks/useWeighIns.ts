import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listWeighIns } from "../repos/weighIns";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads every live weigh-in of the signed in user, newest first (`local_date`, `measured_at`, `id`, all
 * descending), however many there are: the repo reads it a page of 1,000 at a time. Key
 * `keys.weighIns.list`. Weigh-ins are health data, and this key is not in the persisted offline cache.
 */
export function useWeighIns({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.weighIns.list,
    queryFn: () => listWeighIns(client),
    enabled,
  });
}
