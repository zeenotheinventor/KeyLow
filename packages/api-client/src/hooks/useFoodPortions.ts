import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listFoodPortions } from "../repos/foods";

/** Loads a food's portions in display order. Idle until `foodId` is set. */
export function useFoodPortions(foodId: string | undefined) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.foods.portions(foodId ?? ""),
    queryFn: foodId ? () => listFoodPortions(client, foodId) : skipToken,
  });
}
