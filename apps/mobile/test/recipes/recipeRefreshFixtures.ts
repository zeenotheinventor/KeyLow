import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildFood } from "@keylow/core/testing";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { Food } from "@keylow/core/schemas";

export const REFRESH_RECIPE_ID = "55555555-5555-4555-8555-555555555555";

// The preamble's refresh sample: the user's own "Chicken breast fillets" go from 120 kcal, P 22.5, C 0 and
// F 2.1 per 100 g to 110, P 25, C 0 and F 1.0. Four servings make 1,496.8 kcal, P 126.5, C 170.2 and F 32.5,
// which become 1,446.8, P 139, C 170.2 and F 27.
const chickenAsSaved = buildFood({
  id: "00000000-0000-4000-8000-0000000000a1",
  source: "user",
  name: "Chicken breast fillets",
  kcal: 120,
  protein_g: 22.5,
  carbs_g: 0,
  fat_g: 2.1,
});
const rice = buildFood({
  id: "00000000-0000-4000-8000-0000000000a2",
  source: "cofid",
  name: "Long grain rice",
  kcal: 360,
  protein_g: 7,
  carbs_g: 85.1,
  fat_g: 1,
});
const oil = buildFood({
  id: "00000000-0000-4000-8000-0000000000a3",
  source: "cofid",
  name: "Olive oil",
  kcal: 884,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 100,
});

/** Chicken and rice as it was saved: 500 g, 200 g and 20 g of the three foods as they were. */
export const chickenAndRice: RecipeViewRecipe = {
  id: REFRESH_RECIPE_ID,
  name: "Chicken and rice",
  is_archived: false,
  servings: 4,
  yield_grams: 1100,
  instructions: ["Season the chicken.", "Brown it in the oil."],
  ingredients: [
    buildRecipeIngredient(chickenAsSaved, { quantity: 500, unit: "g" }),
    buildRecipeIngredient(rice, { quantity: 200, unit: "g" }),
    buildRecipeIngredient(oil, { quantity: 20, unit: "g" }),
  ],
};

/** The foods as they are today, after the user edited the chicken. */
export const foodsAfterTheChickenEdit: Food[] = [
  { ...chickenAsSaved, kcal: 110, protein_g: 25, fat_g: 1 },
  rice,
  oil,
];

/** The foods exactly as the recipe saved them, so nothing has changed. */
export const foodsAsSaved: Food[] = [chickenAsSaved, rice, oil];

export const oilFood = oil;
