import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { setMealPlanRepeatLimit } from "../repos/mealPlanRepeatLimit";

/**
 * Saves the person's repeat limit (the variable passed to `mutate` is the limit: 0 for no limit, 1 to 7,
 * or null for not chosen). Only the person writes it, from the Plan screen or from the choice the first
 * plan offers. After a success the limit is read again, and the mutation stays pending until that is
 * done. A value outside 0 to 7 is refused before any request.
 */
export function useSetMealPlanRepeatLimit() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (limit: number | null) => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to change the repeat limit", { cause: error });
      }

      await setMealPlanRepeatLimit(client, data.user.id, limit);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.mealPlans.repeatLimit }),
  });
}
