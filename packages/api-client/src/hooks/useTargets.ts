import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyTargets } from "../repos/targets";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the signed in user's manual calorie and macro targets. Each is null when not set, so a null
 * `kcal` is the diary's no-target state. They are health data. Key `keys.profiles.targets`.
 */
export function useTargets({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.profiles.targets,
    queryFn: () => getMyTargets(client),
    enabled,
  });
}
