import { servingOfSearchHit } from "./servingOfSearchHit";

import type { ServingSource } from "./servingOfSearchHit";
import type { Food, FoodPortion } from "../schemas/food";

/** An amount of a food to log from a search row: a count of one of its portions, or grams or millilitres. */
export type HitServing =
  | { quantity: number; unit: "g" | "ml" }
  | { quantity: number; unit: "portion"; portion: FoodPortion };

/**
 * The serving a result row shows (`servingOfSearchHit`), as the amount its plus logs against the food as it is
 * now. If the row's portion has been replaced since the search, it is 100 of the food's basis instead.
 */
export function servingOfHit(
  hit: ServingSource,
  food: Pick<Food, "basis">,
  portions: readonly FoodPortion[],
): HitServing {
  const serving = servingOfSearchHit(hit);
  const portion = portions.find((candidate) => candidate.id === serving.portionId);

  if (portion !== undefined) {
    return { quantity: serving.quantity, unit: "portion", portion };
  }

  return serving.unit === "portion"
    ? { quantity: 100, unit: food.basis === "per_100ml" ? "ml" : "g" }
    : { quantity: serving.quantity, unit: serving.unit };
}
