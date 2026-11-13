import { buildRecipeIngredient, computeRecipe } from "../recipes";

import type { Food, FoodPortion } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

/** The four figures a draft shows for a serving. */
export type DraftFigures = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

// The nutrients of 100 g of the food, from the same snapshot the recipe's own lines are built with.
export const per100Of = (
  food: Food,
  portions: readonly FoodPortion[],
): NullableNutrients | null => {
  try {
    return computeRecipe({
      servings: 1,
      yieldGrams: null,
      ingredients: [
        buildRecipeIngredient(food, { quantity: 100, unit: "g", foodPortions: portions }),
      ],
    }).total;
  } catch (caught) {
    // A food per portion has no weight, so its grams are not an amount. The line is not counted.
    if (caught instanceof RangeError) {
      return null;
    }
    throw caught;
  }
};

export const figuresOf = (nutrients: NullableNutrients): DraftFigures => ({
  kcal: nutrients.kcal,
  protein_g: nutrients.protein_g,
  carbs_g: nutrients.carbs_g,
  fat_g: nutrients.fat_g,
});
