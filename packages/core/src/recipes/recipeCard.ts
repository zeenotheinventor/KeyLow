import { MAX_RECIPE_SERVINGS, MAX_RECIPE_YIELD_GRAMS } from "./bounds";
import { computeRecipe } from "./computeRecipe";
import { hasWeightlessIngredient } from "./weightlessIngredient";
import { enteredNumber } from "../diary/rules/enteredNumber";

import type { RecipeDraft } from "./validateRecipeDraft";
import type { NullableNutrients } from "../schemas/nutrients";

/** What the Per serving card of the editor shows. Nothing is rounded. */
export type RecipeCard = {
  perServing: NullableNutrients;
  per100g: NullableNutrients;
  /**
   * What one serving weighs: the cooked weight over the servings, else the raw total over the servings. Null
   * when the recipe is servings only, which has no weight.
   */
  servingGrams: number | null;
  /** The ingredients weighed raw, added up. */
  totalGrams: number;
  /** Whether `per100g` is of the cooked dish (a cooked weight is entered) or of the raw total. Null when servings only. */
  per100gBasis: "cooked" | "raw" | null;
  /** True when an ingredient has no weight, so the recipe is logged by servings and has no values per 100 g. */
  servingsOnly: boolean;
};

/** A number from a field that is above 0 and within the bound, else null. */
const boundedPositive = (text: string, maximum: number): number | null => {
  const amount = enteredNumber(text);
  return amount !== null && Number.isFinite(amount) && amount > 0 && amount <= maximum
    ? amount
    : null;
};

/**
 * The numbers for the Per serving card, worked out with `computeRecipe` so the editor and a saved recipe
 * never differ. It is null when there is nothing to work out: no ingredients, or servings that are not a
 * number above 0 and at most `MAX_RECIPE_SERVINGS`. A cooked weight that is not usable is read as none, so
 * the card still shows, on the raw total.
 */
export const recipeCardOf = (
  draft: Pick<RecipeDraft, "servings" | "cookedWeight" | "ingredients">,
): RecipeCard | null => {
  const servings = boundedPositive(draft.servings, MAX_RECIPE_SERVINGS);
  if (servings === null || draft.ingredients.length === 0) {
    return null;
  }
  const servingsOnly = hasWeightlessIngredient(draft.ingredients);
  // A cooked weight left in the draft is ignored for a recipe that is servings only, and Save refuses it.
  const yieldGrams = servingsOnly
    ? null
    : boundedPositive(draft.cookedWeight, MAX_RECIPE_YIELD_GRAMS);
  const computed = computeRecipe({ servings, yieldGrams, ingredients: draft.ingredients });
  return {
    perServing: computed.perServing,
    per100g: computed.per100g,
    servingGrams: servingsOnly ? null : computed.effectiveGrams / servings,
    totalGrams: computed.totalGrams,
    per100gBasis: servingsOnly ? null : yieldGrams === null ? "raw" : "cooked",
    servingsOnly,
  };
};
