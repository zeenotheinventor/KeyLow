import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listPalatePreferences } from "../repos/palatePreferences";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the signed in user's stated dislikes and allergies and their "not true" corrections, oldest
 * first. A palate is health data, so an error names the action and the code only. Key
 * `keys.palate.preferences`, which no device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function usePalatePreferences({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.palate.preferences,
    queryFn: () => listPalatePreferences(client),
    enabled,
  });
}
