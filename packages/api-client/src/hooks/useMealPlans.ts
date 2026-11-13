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
export function useMealPlans({
  enabled = true,
  staleTime,
}: DiaryReadOptions & {
  /**
   * How long, in milliseconds, a read stays fresh. The Diary reads the plans to show its planned row and passes a few
   * minutes, so opening the Diary again does not read every plan each time. Left out, a read is always stale, as the
   * Plan screen wants.
   */
  staleTime?: number;
} = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.mealPlans.list,
    queryFn: () => listMealPlans(client),
    enabled,
    ...(staleTime === undefined ? {} : { staleTime }),
  });
}
