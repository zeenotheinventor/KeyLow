import { describeAdjustedRecipeName } from "../copy/assistantRecipeCompareCard";
import { buildRecipeIngredient } from "../recipes/buildRecipeIngredient";

import type { AssistantRecipeDraft } from "./recipeDraft";
import type { RecipeIngredient } from "../recipes/schemas";
import type { RecipeDraft } from "../recipes/validateRecipeDraft";
import type { Food, FoodPortion } from "../schemas/food";

/** A food a draft line matched, with its portions, as the app reads them to open the editor. */
export type PrefillFood = { food: Food; portions: readonly FoodPortion[] };

/**
 * Why a draft cannot open the editor: `food_missing` when a matched food is not among the foods that were loaded
 * (the connection, or a food that is gone), and `not_rebuildable` when an adjustment's line cannot be made again
 * in grams, which is a line with no food or one counted by portion and so with no weight.
 */
export type RecipePrefillRefusal = "food_missing" | "not_rebuildable";

export type RecipePrefillOutcome =
  { ok: true; draft: RecipeDraft } | { ok: false; reason: RecipePrefillRefusal };

/**
 * The recipe editor's draft for a drafted recipe, so Save to recipes (or Save as new recipe, for an adjustment)
 * opens the editor filled in. Each matched line is an ingredient of its food in grams, frozen with the food's
 * own snapshot as the editor freezes one it adds. A suggestion's line that matched no food is left out, as the
 * card says it is not counted: the person chooses a food for it in the editor. An adjustment opens as a NEW
 * recipe named for it ("Eval chicken and rice, adjusted") with the original's own steps, and a line the fit
 * removed is left out. It refuses, with the reason, when a matched food is not among `foods`, so a recipe is never
 * opened short of what the card showed, and when an adjustment's line has no grams or no food.
 */
export function recipeDraftPrefillOf(
  draft: AssistantRecipeDraft,
  foods: ReadonlyMap<string, PrefillFood>,
): RecipePrefillOutcome {
  const isAdjustment = draft.variant === "adjustment";
  const ingredients: RecipeIngredient[] = [];
  for (const line of draft.ingredients) {
    if (isAdjustment && line.change === "removed") {
      continue;
    }
    if (line.foodId === null) {
      if (isAdjustment) {
        return { ok: false, reason: "not_rebuildable" };
      }
      continue;
    }
    const found = foods.get(line.foodId);
    if (found === undefined) {
      return { ok: false, reason: "food_missing" };
    }
    if (isAdjustment && line.grams <= 0) {
      return { ok: false, reason: "not_rebuildable" };
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
    ok: true,
    draft: {
      name: isAdjustment ? describeAdjustedRecipeName(draft.name) : draft.name,
      servings: String(draft.servings),
      cookedWeight: "",
      ingredients,
      steps: [...draft.steps],
    },
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
