import { buildFoodSnapshot } from "../diary/buildFoodSnapshot";
import { foodEntryFields } from "../diary/foodEntryFields";

import type { RecipeIngredient } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { Food, FoodPortion } from "../schemas/food";

export type RecipeIngredientInput = {
  quantity: number;
  unit: QuantityUnit;
  /** Read only when the unit is `portion`. Its id becomes the ingredient's `portion_id`, except for a spoon. */
  portion?: Pick<FoodPortion, "id" | "label" | "grams" | "ml">;
};

/**
 * Builds one recipe ingredient from a food and an amount. The food is frozen with `buildFoodSnapshot`,
 * so its nutrients, basis and density (its own, else the estimate for its group) are fixed when the
 * ingredient is added, and a later change to the food or to the density table never moves the recipe
 * (ADR 0003, Amendment 8). The columns are derived from the snapshot as for a log entry, so
 * `portion_id` is the portion's id for a portion that is a table row and null for every other unit
 * and for a spoon, which is not a database row.
 *
 * Throws a `RangeError` for a quantity that is negative or not finite, and what `buildFoodSnapshot`
 * throws for the `portion` unit without a portion and for a portion that does not have exactly one of
 * `grams` and `ml`. The message states the rule and never the amount (ADR 0003, Amendment 8, "Health
 * data"). The stored-row rules (an amount above 0, the grams bounds) are in `recipeIngredientSchema`.
 */
export const buildRecipeIngredient = (
  food: Food,
  input: RecipeIngredientInput,
): RecipeIngredient => {
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new RangeError("The quantity must be a finite number of at least 0");
  }
  const snapshot = buildFoodSnapshot(food, input);
  const { food_id, quantity, unit, portion_id, resolved_grams } = foodEntryFields(
    snapshot,
    input.portion?.id ?? null,
  );
  return { food_id, quantity, unit, portion_id, resolved_grams, snapshot };
};
