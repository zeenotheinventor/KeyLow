import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMySetupState } from "../repos/setup";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads what the setup wizard starts from: whether the signed in user is set up, their stats, the
 * active program and the latest weigh-in. It is health data. Key `keys.profiles.setupState`, which is
 * not in the persisted offline cache: with nothing cached and no connection the query has no data, and
 * the first run gate reads that as unknown and stays open.
 */
export function useSetupState({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.profiles.setupState,
    queryFn: () => getMySetupState(client),
    enabled,
  });
}
