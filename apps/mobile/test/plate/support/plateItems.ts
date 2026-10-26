import { plateItemOfPickedFood, plateItemOfRecipe } from "@keylow/core/plate";

import { foodFixture, portionFixtures, savedFoodId } from "../../foods/support/apiClientMock";
import { goldenRecipe } from "../../foods/support/recipeFixtures";

import type { PlateFoodItem, PlateRecipeItem } from "@keylow/core/plate";

export { savedFoodId };

/** The oat bar fixture counted in grams: 420 kcal per 100 g, so 100 g comes to 420 kcal. */
export function oatBarInGrams(key: string, quantity = 100): PlateFoodItem {
  return plateItemOfPickedFood({
    key,
    food: foodFixture,
    portions: portionFixtures,
    amount: { unit: "g", quantity },
  });
}

/** The oat bar fixture counted in its first portion ("1 bar", 45 g). */
export function oatBarInBars(key: string, quantity = 1): PlateFoodItem {
  const [bar] = portionFixtures;
  if (bar === undefined) {
    throw new Error("The fixture has no portion");
  }

  return plateItemOfPickedFood({
    key,
    food: foodFixture,
    portions: portionFixtures,
    amount: { unit: "portion", quantity, portion: bar },
  });
}

/** Chicken and rice, one serving. */
export function chickenAndRice(key: string): PlateRecipeItem {
  return plateItemOfRecipe({ key, recipe: goldenRecipe() });
}
