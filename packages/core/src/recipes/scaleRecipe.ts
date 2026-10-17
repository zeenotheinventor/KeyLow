import { MAX_RECIPE_SERVINGS } from "./bounds";

import type { RecipeIngredient } from "./schemas";
import type { LoggedAmount } from "../copy/diary";

/**
 * How many times a recipe is made when a cook picks a number of servings: the chosen number over the
 * recipe's own (saved) servings, whatever that is, so a recipe saved at 2.5 servings works too. The chosen
 * number is a whole number from 1 to `MAX_RECIPE_SERVINGS`, or exactly the recipe's own servings (a view
 * that starts at 2.5 accepts 2.5 back). Nothing is rounded.
 *
 * Throws a `RangeError`, before any maths, for recipe servings that are not a finite number above 0 and
 * for a chosen number that is neither of the above. The messages state the rule and never the value.
 */
export const scaleFactor = (chosenServings: number, recipeServings: number): number => {
  if (!Number.isFinite(recipeServings) || recipeServings <= 0) {
    throw new RangeError("The recipe's servings must be a finite number above 0");
  }
  const isWholeServings =
    Number.isInteger(chosenServings) &&
    chosenServings >= 1 &&
    chosenServings <= MAX_RECIPE_SERVINGS;
  if (!isWholeServings && chosenServings !== recipeServings) {
    throw new RangeError(
      `Servings must be a whole number from 1 to ${MAX_RECIPE_SERVINGS}, or the recipe's own`,
    );
  }
  return chosenServings / recipeServings;
};

/** Only what scaling reads of a stored ingredient, so a stored row and a built one both fit. */
export type ScalableIngredient = Pick<RecipeIngredient, "quantity" | "unit" | "resolved_grams"> & {
  snapshot: Pick<RecipeIngredient["snapshot"], "portion">;
};

/**
 * An ingredient's amount for a scaled batch, in the shape `describeLoggedAmount` reads. The quantity and
 * the resolved grams are multiplied by the factor; the unit and the portion are kept as they are, so grams
 * stay grams, a natural portion stays that portion and a spoon stays that spoon. Nothing is rounded, and
 * the ingredient is not changed. The factor is computed once by `scaleFactor`, so it is exact for 4 to 6
 * servings (1.5) and for any other pair whose quotient is a binary fraction; for a pair such as 3 to 4
 * (1.333...) the product can differ from the exact amount by float error. That can flip a displayed gram at
 * an exact half (rare), so a caller that rounds may round with a small epsilon.
 */
export const scaleIngredientAmount = (
  ingredient: ScalableIngredient,
  factor: number,
): LoggedAmount => ({
  unit: ingredient.unit,
  quantity: ingredient.quantity * factor,
  resolvedGrams: ingredient.resolved_grams * factor,
  portion: ingredient.snapshot.portion,
});

/** The cooked weight for a scaled batch, or null when the recipe has none. */
export const scaleYield = (yieldGrams: number | null, factor: number): number | null =>
  yieldGrams === null ? null : yieldGrams * factor;
