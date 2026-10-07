import { useFood, useFoodPortions } from "@keylow/api-client";

import type { Food, FoodPortion } from "@keylow/core/schemas";

export type FoodWithPortionsState =
  | { kind: "loading" }
  | { kind: "failed"; message: string }
  | { kind: "not_found" }
  | { kind: "ready"; food: Food; portions: FoodPortion[] };

/**
 * A food and its portions as one state. A failure only takes over once there is no data to show,
 * so a failed background refresh does not replace a screen the user is looking at.
 */
export function useFoodWithPortions(id: string): FoodWithPortionsState {
  const food = useFood(id);
  const portions = useFoodPortions(id);

  if (food.data === undefined && food.isError) {
    return { kind: "failed", message: food.error.message };
  }
  if (portions.data === undefined && portions.isError) {
    return { kind: "failed", message: portions.error.message };
  }
  if (food.data === undefined || portions.data === undefined) {
    return { kind: "loading" };
  }
  if (food.data === null) {
    return { kind: "not_found" };
  }
  return { kind: "ready", food: food.data, portions: portions.data };
}
