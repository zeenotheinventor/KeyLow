import { buildRecipeLogEntry } from "./buildRecipeLogEntry";
import { previewRecipeAmount } from "./previewRecipeAmount";
import { parseFormNumber } from "../foods/foodForm";

import type { RecipeAmountValues } from "./previewRecipeAmount";
import type { LoggableRecipe, RecipeAmount } from "./recipeSnapshotQuantity";

/** What an amount typed for a recipe comes to: the amount, its energy and macros, and the weight it is. */
export type TypedRecipeAmount = {
  amount: RecipeAmount;
  values: RecipeAmountValues;
  /** The grams the amount comes to, which the hero's caption writes after a number of servings. */
  resolvedGrams: number;
};

/**
 * What the text in the amount field and the chosen unit make for a recipe, or null while they make no amount
 * that can be logged: text that is not a number above 0, an amount too large to work out, a recipe with no
 * weight. The values are core's `previewRecipeAmount`, and the grams are those of the entry that would be
 * stored, so the hero, its caption and the stored entry agree to the digit.
 */
export function previewTypedRecipeAmount(
  recipe: LoggableRecipe,
  unit: RecipeAmount["unit"],
  quantityText: string,
): TypedRecipeAmount | null {
  const amount: RecipeAmount = { quantity: parseFormNumber(quantityText) ?? Number.NaN, unit };
  const values = previewRecipeAmount(recipe, amount);
  if (values === null) {
    return null;
  }
  // Only the grams of the entry are read, so the time it would be logged at does not matter here.
  const { resolved_grams: resolvedGrams } = buildRecipeLogEntry({
    recipe,
    ...amount,
    loggedAt: "",
    localDate: "",
  });

  return { amount, values, resolvedGrams };
}
