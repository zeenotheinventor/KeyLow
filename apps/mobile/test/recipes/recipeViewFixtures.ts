import { SPOON_PORTIONS } from "@keylow/core/nutrition";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe, buildFood, buildFoodPortion } from "@keylow/core/testing";

import type { RecipeViewRecipe } from "../../components/RecipeView";

export const CHICKEN_AND_RICE_ID = "55555555-5555-4555-8555-555555555555";
export const FRITTATA_ID = "66666666-6666-4666-8666-666666666666";

const chickenAndRice = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
const preambleNames = ["Chicken breast fillets", "Long grain rice", "Olive oil"];

/** Chicken and rice as the boards draw it: 4 servings, 1,100 g cooked, 500 g, 200 g and 20 g, and five steps. */
export const chickenAndRiceRecipe: RecipeViewRecipe = {
  id: CHICKEN_AND_RICE_ID,
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  instructions: [
    "Season the chicken.",
    "Brown it in the oil.",
    "Add the rice and water.",
    "Cover and simmer for 18 minutes.",
    "Rest for 5 minutes, then serve.",
  ],
  ingredients: chickenAndRice.ingredients.map((ingredient, position) => ({
    ...ingredient,
    snapshot: { ...ingredient.snapshot, name: preambleNames[position] ?? "" },
  })),
};

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}
const largeEgg = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b1",
  label: "1 large",
  grams: 50,
});
const mediumOnion = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000b2",
  label: "1 medium",
  grams: 110,
});

/** The preamble's frittata: 4 servings, 620 g cooked and six ingredients in four kinds of unit. */
export const frittataRecipe: RecipeViewRecipe = {
  id: FRITTATA_ID,
  name: "Spinach and cheddar frittata",
  servings: 4,
  yield_grams: 620,
  instructions: ["Heat the oven to 200 °C (fan 180 °C).", "Fry the onion in the oil."],
  ingredients: [
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c1", name: "Eggs, chicken, whole, raw" }),
      { quantity: 6, unit: "portion", portion: largeEgg },
    ),
    buildRecipeIngredient(
      buildFood({
        id: "00000000-0000-4000-8000-0000000000c2",
        name: "Milk, semi-skimmed, pasteurised, average",
        density_g_per_ml: 1.03,
      }),
      { quantity: 100, unit: "ml" },
    ),
    buildRecipeIngredient(
      buildFood({
        id: "00000000-0000-4000-8000-0000000000c3",
        name: "Oil, olive",
        density_g_per_ml: 0.92,
      }),
      { quantity: 1, unit: "portion", portion: tablespoon },
    ),
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c4", name: "Onions, raw" }),
      { quantity: 1, unit: "portion", portion: mediumOnion },
    ),
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c5", name: "Spinach, baby, raw" }),
      { quantity: 100, unit: "g" },
    ),
    buildRecipeIngredient(
      buildFood({ id: "00000000-0000-4000-8000-0000000000c6", name: "Cheese, Cheddar, English" }),
      { quantity: 60, unit: "g" },
    ),
  ],
};
