import { keys } from "./queryKeys";

import type { OffProductResponse } from "@keylow/core/schemas";
import type { QueryClient } from "@tanstack/react-query";

/** Puts a food that `off-product` returned, and its portions, in the caches the detail screens read. */
export function seedOffProduct(queryClient: QueryClient, { food, portions }: OffProductResponse) {
  queryClient.setQueryData(keys.foods.detail(food.id), food);
  queryClient.setQueryData(keys.foods.portions(food.id), portions);
}
