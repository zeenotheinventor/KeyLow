import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMealPlanRepeatLimit } from "../repos/mealPlanRepeatLimit";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the most times one recipe may appear in a week's plan, as the signed in user chose it: null when
 * they have not chosen (core applies its default then), 0 for no limit, and 1 to 7 otherwise. Key
 * `keys.mealPlans.repeatLimit`, which no device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function useMealPlanRepeatLimit({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.mealPlans.repeatLimit,
    queryFn: () => getMealPlanRepeatLimit(client),
    enabled,
  });
}
