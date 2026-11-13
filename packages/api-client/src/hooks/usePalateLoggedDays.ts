import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getPalateLoggedDays } from "../repos/palatePreferences";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads how many of the last 90 days the signed in user has anything logged, which core reads beside
 * `usePalateStats` for how often a food comes up. It comes from the diary, so it is health data: an
 * error names the action and the code only. Key `keys.palate.loggedDays`, which no device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function usePalateLoggedDays({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.palate.loggedDays,
    queryFn: () => getPalateLoggedDays(client),
    enabled,
  });
}
