import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listFavouriteRecipes } from "../repos/favourites";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the recipes the user has favourited, newest first, each as the library lists it now. Key
 * `keys.recipes.favourites`, so archiving or saving a recipe refreshes it with the other recipes queries.
 */
export function useFavouriteRecipes({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.recipes.favourites,
    queryFn: () => listFavouriteRecipes(client),
    enabled,
  });
}
