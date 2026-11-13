import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refreshDiary } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { confirmMealPlanDay } from "../repos/mealPlans";

import type { LogEntriesItem } from "../repos/diaryWrites";

/**
 * Confirms a day of a plan (the variable passed to `mutate` is `{ dayId, items }`, the foods and recipes
 * as they are now with their amounts and times). Core builds each diary entry with a fresh snapshot, and
 * the database writes them and stamps the day in one transaction. Resolves to the new entry ids in the
 * order given. A day that is already confirmed is refused, so a second tap writes nothing.
 *
 * The plans and the diary are read again once it settles, also after a failure, since a lost response may
 * still have written the entries.
 */
export function useConfirmMealPlanDay() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dayId, items }: { dayId: string; items: readonly LogEntriesItem[] }) =>
      confirmMealPlanDay(client, dayId, items),
    onSettled: () => {
      refreshDiary(queryClient);
      return queryClient.invalidateQueries({ queryKey: keys.mealPlans.all });
    },
  });
}
