import { buildRecipeIngredient } from "../recipes/buildRecipeIngredient";

import type { AssistantRecipeDraft } from "./recipeDraft";
import type { RecipeIngredient } from "../recipes/schemas";
import type { RecipeDraft } from "../recipes/validateRecipeDraft";
import type { Food, FoodPortion } from "../schemas/food";

/** A food a draft line matched, with its portions, as the app reads them to open the editor. */
export type PrefillFood = { food: Food; portions: readonly FoodPortion[] };

/**
 * The recipe editor's draft for a suggested recipe, so Save to recipes opens the editor filled in. Each matched
 * line is an ingredient of its food in grams, frozen with the food's own snapshot as the editor freezes one it
 * adds. A line that matched no food is left out, as the card says it is not counted: the person chooses a food
 * for it in the editor. Null when a matched food is not among `foods`, so a recipe is never opened short of
 * what the card showed, and null for an adjustment, which saves as a new recipe through its own card.
 */
export function recipeDraftPrefillOf(
  draft: AssistantRecipeDraft,
  foods: ReadonlyMap<string, PrefillFood>,
): RecipeDraft | null {
  if (draft.variant !== "suggestion") {
    return null;
  }
  const ingredients: RecipeIngredient[] = [];
  for (const line of draft.ingredients) {
    if (line.foodId === null) {
      continue;
    }
    const found = foods.get(line.foodId);
    if (found === undefined) {
      return null;
    }
    ingredients.push(
      buildRecipeIngredient(found.food, {
        quantity: line.grams,
        unit: "g",
        foodPortions: found.portions,
      }),
    );
  }
  return {
    name: draft.name,
    servings: String(draft.servings),
    cookedWeight: "",
    ingredients,
    steps: [...draft.steps],
  };
}

/** The ids of the foods the matched lines of a draft named, in line order, which the editor needs to open on it. */
export const matchedFoodIdsOf = (draft: AssistantRecipeDraft): string[] =>
  draft.ingredients.flatMap(({ foodId }) => (foodId === null ? [] : [foodId]));

/**
 * The name of the first line that matched no food, which the editor opens its add-ingredient search on, so the
 * person sees what is missing. Null when every line matched.
 */
export const firstUnmatchedLineNameOf = (draft: AssistantRecipeDraft): string | null =>
  draft.ingredients.find(({ foodId }) => foodId === null)?.name ?? null;
