import type { RecipeIngredient } from "./schemas";

/** What is read of an ingredient to tell whether it has a weight: only its frozen basis. */
type IngredientWithBasis = { snapshot: Pick<RecipeIngredient["snapshot"], "basis"> };

/**
 * Whether an ingredient has no weight: a food per portion, such as a restaurant bucket, which is counted in
 * portions and stores 0 grams (ADR 0003, Amendment 19).
 */
export const isWeightlessIngredient = (ingredient: IngredientWithBasis): boolean =>
  ingredient.snapshot.basis === "per_portion";

/**
 * Whether a recipe is logged by servings only: it holds at least one ingredient with no weight, so it has no
 * true weight, no cooked weight and no values per 100 g.
 */
export const hasWeightlessIngredient = (ingredients: readonly IngredientWithBasis[]): boolean =>
  ingredients.some(isWeightlessIngredient);

/**
 * Whether the editor shows the Cooked weight field. A recipe with a food per portion has no cooked weight, so
 * the field is hidden, unless it still holds a weight typed before that food was added, which Save refuses and
 * the field shows the error for (ADR 0003, Amendment 19). Nothing is cleared silently.
 */
export const showsCookedWeight = (draft: {
  ingredients: readonly IngredientWithBasis[];
  cookedWeight: string;
}): boolean => !hasWeightlessIngredient(draft.ingredients) || draft.cookedWeight.trim() !== "";
