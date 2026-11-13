import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listMealPlans } from "../repos/mealPlans";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the signed in user's plans that are not archived, with their days and items, the earliest start
 * first. A plan says what a person intends to eat, so it is health data: an error names the action and the
 * code only. Key `keys.mealPlans.list`, which no device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function useMealPlans({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.mealPlans.list,
    queryFn: () => listMealPlans(client),
    enabled,
  });
}
