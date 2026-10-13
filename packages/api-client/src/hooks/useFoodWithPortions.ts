import { useFood } from "./useFood";
import { useFoodPortions } from "./useFoodPortions";

import type { Food, FoodPortion } from "@keylow/core/schemas";

export type FoodWithPortionsState =
  | { status: "loading" }
  | {
      status: "error";
      /** The raw text of the failure, for logs and bug reports only. The UI must never render it. */
      debugMessage: string;
    }
  | { status: "notFound" }
  | { status: "ready"; food: Food; portions: FoodPortion[] };

/**
 * A food and its portions as one screen state. `error` is only taken when there is no data to show
 * yet, so a failed background refetch never replaces a food the user is looking at. `notFound`
 * means the food is not visible to the user (it does not exist, or is not theirs and not shared).
 */
export function useFoodWithPortions(id: string): FoodWithPortionsState {
  const food = useFood(id);
  const portions = useFoodPortions(id);

  if (food.data === undefined && food.isError) {
    return { status: "error", debugMessage: food.error.message };
  }
  if (portions.data === undefined && portions.isError) {
    return { status: "error", debugMessage: portions.error.message };
  }
  if (food.data === undefined || portions.data === undefined) {
    return { status: "loading" };
  }
  if (food.data === null) {
    return { status: "notFound" };
  }
  return { status: "ready", food: food.data, portions: portions.data };
}
