import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listPalateStats } from "../repos/palatePreferences";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads what the signed in user eats most over the last 90 days, one row per food or recipe, the most
 * logged first. The figures are counted by the database, and core decides what counts as usual. They
 * come from the diary, so they are health data: an error names the action and the code only. Key
 * `keys.palate.stats`, which no device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function usePalateStats({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.palate.stats,
    queryFn: () => listPalateStats(client),
    enabled,
  });
}
