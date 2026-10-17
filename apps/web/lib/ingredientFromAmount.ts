import { SNAPSHOT_PORTION_ID, foodOfSnapshot } from "@keylow/core/diary";
import { buildRecipeIngredient } from "@keylow/core/recipes";

import type { ChosenAmount } from "@keylow/core/diary";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food } from "@keylow/core/schemas";

// A snapshot has no creation time of its own, and the food made from one never shows or stores it.
const FROZEN_FOOD_CREATED_AT = "1970-01-01T00:00:00.000Z";

const inputOf = (amount: ChosenAmount) => ({
  quantity: amount.quantity,
  unit: amount.unit,
  ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
});

/** An ingredient of `amount` of `food`, with the food's values as they are now frozen into it. */
export const newIngredient = (food: Food, amount: ChosenAmount): RecipeIngredient =>
  buildRecipeIngredient(food, inputOf(amount));

/**
 * The same ingredient with another amount. The food's values stay the ones it was added with, so a food
 * edited since changes nothing here (only Refresh ingredients moves them), as an edited diary entry does.
 * The portion the ingredient was added with keeps its link when its chip is still chosen.
 */
export const editedIngredient = (
  ingredient: RecipeIngredient,
  amount: ChosenAmount,
): RecipeIngredient => {
  const rebuilt = buildRecipeIngredient(
    foodOfSnapshot(ingredient.snapshot, FROZEN_FOOD_CREATED_AT),
    inputOf(amount),
  );

  return amount.unit === "portion" && amount.portion.id === SNAPSHOT_PORTION_ID
    ? { ...rebuilt, portion_id: ingredient.portion_id }
    : rebuilt;
};
