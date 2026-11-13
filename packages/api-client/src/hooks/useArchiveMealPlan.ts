import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { archiveMealPlan } from "../repos/mealPlans";

/**
 * Archives a plan (the variable passed to `mutate` is its id), which is what the Undo of a plan does.
 * A plan is never deleted. The plans are read again once it settles, also after a failure.
 */
export function useArchiveMealPlan() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => archiveMealPlan(client, planId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.mealPlans.all }),
  });
}
