import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getFood } from "../repos/foods";

/** Loads one food, resolving to null when it is not visible to the user. Idle until `id` is set. */
export function useFood(id: string | undefined) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.foods.detail(id ?? ""),
    queryFn: id ? () => getFood(client, id) : skipToken,
  });
}
