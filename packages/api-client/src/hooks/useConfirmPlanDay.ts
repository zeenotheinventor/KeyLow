import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refreshDiary } from "../diaryCache";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { confirmPlannedDay } from "../repos/plannedDay";

import type { MealPlanDay } from "../repos/mealPlans";

/**
 * Confirms a day of a plan from the day as the screen has it (the variable passed to `mutate` is
 * `{ day, timeZone }`). The foods and recipes are read as they are now and written as diary entries at their
 * times, so every snapshot is fresh, and the day is stamped in the same transaction. Resolves to the new entry
 * ids. A day that is already confirmed is refused before any request, so a second tap writes nothing.
 *
 * The plans and the diary are read again once it settles, also after a failure, since a lost response may
 * still have written the entries.
 */
export function useConfirmPlanDay() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      day,
      timeZone,
    }: {
      day: Pick<MealPlanDay, "id" | "localDate" | "confirmedAt" | "items">;
      timeZone: string;
    }) => confirmPlannedDay(client, day, timeZone),
    onSettled: () => {
      refreshDiary(queryClient);
      return queryClient.invalidateQueries({ queryKey: keys.mealPlans.all });
    },
  });
}
