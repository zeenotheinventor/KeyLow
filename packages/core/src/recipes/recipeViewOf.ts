import { scaleFactor, scaleIngredientAmount, scaleYield } from "./scaleRecipe";
import { describeRecipeYield } from "../copy/recipeLog";
import {
  describeIngredientsFor,
  describeResetServings,
  describeServingsAnnouncement,
  describeServingsValue,
  describeStepsServingsNote,
} from "../copy/recipeView";
import { describeScaledAmount } from "../copy/scaledAmount";

import type { StoredRecipe } from "./recipeDraft";

/** One ingredient row of the recipe view. */
export type RecipeViewIngredient = {
  name: string;
  /** The scaled amount: "750 g", "3 × 1 large (150 g)". */
  caption: string;
  /** What a screen reader reads for the row: the name, then the caption. */
  accessibleName: string;
};

/** Everything the recipe view prints that depends on the servings. */
export type RecipeView = {
  /** The effective number of servings: the chosen one, else the recipe's own. */
  servings: number;
  /** Whether the servings differ from the recipe's own. */
  isScaled: boolean;
  /** The stepper's value as a screen reader reads it: "6 servings". */
  valueText: string;
  yieldLine: string;
  ingredientsFor: string;
  /** In the recipe's order. */
  ingredients: RecipeViewIngredient[];
  /** Shown once scaled, and only when the recipe has steps. */
  stepsNote: string | null;
  /** The Reset link, once scaled. */
  resetLabel: string | null;
  announcement: string;
};

/**
 * The recipe view for a number of servings. `chosenServings` is null for the recipe's own. Nothing is
 * rounded before display, and nothing here touches the nutrients: the Per serving card does not move when
 * the servings do. Throws a `RangeError`, from `scaleFactor`, for a number that is neither a whole number
 * from 1 to `MAX_RECIPE_SERVINGS` nor the recipe's own, so a screen passes what `enteredViewServings` or
 * `stepViewServings` gave.
 */
export const recipeViewOf = (recipe: StoredRecipe, chosenServings: number | null): RecipeView => {
  const servings = chosenServings ?? recipe.servings;
  const factor = scaleFactor(servings, recipe.servings);
  const isScaled = servings !== recipe.servings;
  const cookedGrams = scaleYield(recipe.yield_grams, factor);

  return {
    servings,
    isScaled,
    valueText: describeServingsValue(servings),
    yieldLine: describeRecipeYield(servings, cookedGrams),
    ingredientsFor: describeIngredientsFor(servings),
    ingredients: recipe.ingredients.map((ingredient) => {
      const name = ingredient.snapshot.name;
      const caption = describeScaledAmount(scaleIngredientAmount(ingredient, factor));

      return { name, caption, accessibleName: `${name}, ${caption}` };
    }),
    stepsNote:
      isScaled && recipe.instructions.length > 0
        ? describeStepsServingsNote(recipe.servings)
        : null,
    resetLabel: isScaled ? describeResetServings(recipe.servings) : null,
    announcement: describeServingsAnnouncement(servings, cookedGrams),
  };
};
