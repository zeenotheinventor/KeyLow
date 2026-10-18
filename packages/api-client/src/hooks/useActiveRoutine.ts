import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getActiveRoutine } from "../repos/training";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the active routine with its days, exercises and muscle maps, or null when there is none. Key
 * `keys.training.activeRoutine`. Every training hook that needs the routine reads it here, so one
 * fetch serves them all.
 */
export function useActiveRoutine({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.activeRoutine,
    queryFn: () => getActiveRoutine(client),
    enabled,
  });
}
