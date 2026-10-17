import {
  freezeRecipe,
  nutrientsOfRecipeSnapshot,
  withRecipeQuantity,
} from "./recipeSnapshotQuantity";

import type { LoggableRecipe, RecipeAmount } from "./recipeSnapshotQuantity";
import type { NullableNutrients } from "../schemas/nutrients";

/** What the picker's hero draws for an amount of a recipe: energy and the three macros. */
export type RecipeAmountValues = Pick<
  NullableNutrients,
  "kcal" | "protein_g" | "carbs_g" | "fat_g"
>;

/** Where the recipe picker opens: one serving. */
export const recipeAmountStart = (): RecipeAmount => ({ quantity: 1, unit: "serving" });

/**
 * What an amount of a recipe comes to before it is logged. The values come from the same two functions
 * `buildRecipeLogEntry` and `recomputeRecipeEntry` use, so the hero and the logged entry agree to the
 * digit. An amount that is not above 0, a recipe that cannot be logged and an amount too large to work
 * out all give null, never an error. The `RangeError` message is not kept: the amount is health data.
 */
export const previewRecipeAmount = (
  recipe: LoggableRecipe,
  amount: RecipeAmount,
): RecipeAmountValues | null => {
  if (!(amount.quantity > 0)) {
    return null;
  }
  try {
    const { kcal, protein_g, carbs_g, fat_g } = nutrientsOfRecipeSnapshot(
      withRecipeQuantity(freezeRecipe(recipe), amount),
    );
    return { kcal, protein_g, carbs_g, fat_g };
  } catch (error) {
    if (error instanceof RangeError) {
      return null;
    }
    throw error;
  }
};
