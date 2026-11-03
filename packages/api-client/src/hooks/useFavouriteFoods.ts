import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listFavouriteFoods } from "../repos/favourites";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the foods the user has favourited, newest first, each with the food as it is now. Key
 * `keys.foods.favourites`, so deleting or editing a food refreshes it with the other foods queries.
 */
export function useFavouriteFoods({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.foods.favourites,
    queryFn: () => listFavouriteFoods(client),
    enabled,
  });
}
