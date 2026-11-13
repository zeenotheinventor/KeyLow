import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { saveMealPlan } from "../repos/mealPlans";

import type { SaveMealPlanInput } from "../repos/mealPlans";

/**
 * Saves a plan, its days and its items in one call, all or nothing, and resolves to the new plan's id.
 * The plans are read again once it settles, also after a failure, since a lost response may still have
 * stored the plan. A wrong input is refused before any request.
 */
export function useSaveMealPlan() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveMealPlanInput) => saveMealPlan(client, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.mealPlans.all }),
  });
}
