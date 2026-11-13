import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { replaceMealPlanDay } from "../repos/mealPlans";

import type { MealPlanItemInput } from "../repos/mealPlans";

/**
 * Replaces the items of one day of a plan, all or nothing (the variable passed to `mutate` is
 * `{ dayId, items }`). The database refuses a day that is already confirmed. The plans are read again
 * once it settles, also after a failure.
 */
export function useReplaceMealPlanDay() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dayId, items }: { dayId: string; items: readonly MealPlanItemInput[] }) =>
      replaceMealPlanDay(client, dayId, items),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.mealPlans.all }),
  });
}
