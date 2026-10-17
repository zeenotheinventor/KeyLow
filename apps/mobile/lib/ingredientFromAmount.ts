import {
  SNAPSHOT_PORTION_ID,
  foodOfSnapshot,
  snapshotAmountStart,
  unitValueOf,
} from "@keylow/core/diary";
import { buildRecipeIngredient } from "@keylow/core/recipes";

import type { ChosenAmount } from "@keylow/core/diary";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food } from "@keylow/core/schemas";

// A snapshot has no creation time of its own, and the food made from one never shows or stores it.
const FROZEN_FOOD_CREATED_AT = "1970-01-01T00:00:00.000Z";

/** The food as the ingredient froze it, for the screens that draw a food (the hero, the values per 100 g). */
export const frozenFoodOf = (ingredient: RecipeIngredient): Food =>
  foodOfSnapshot(ingredient.snapshot, FROZEN_FOOD_CREATED_AT);

const inputOf = (amount: ChosenAmount) => ({
  quantity: amount.quantity,
  unit: amount.unit,
  ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
});

/**
 * The ingredient with the amount the amount step handed over. The food's values stay the ones it was added
 * with, so a food edited since changes nothing here (only Refresh ingredients moves them), as an edited diary
 * entry does. An amount left as it was, on the chip it started on, gives the ingredient back as it is. The
 * portion the ingredient was added with keeps its link when its chip is still chosen.
 */
export function ingredientWithAmount(
  ingredient: RecipeIngredient,
  amount: ChosenAmount,
): RecipeIngredient {
  const start = snapshotAmountStart(ingredient.snapshot);
  if (unitValueOf(amount) === start.unitValue && String(amount.quantity) === start.quantity) {
    return ingredient;
  }

  const rebuilt = buildRecipeIngredient(frozenFoodOf(ingredient), inputOf(amount));

  return amount.unit === "portion" && amount.portion.id === SNAPSHOT_PORTION_ID
    ? { ...rebuilt, portion_id: ingredient.portion_id }
    : rebuilt;
}
