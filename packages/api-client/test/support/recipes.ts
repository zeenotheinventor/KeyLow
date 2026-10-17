import { computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";

import type { RecipeComputed } from "@keylow/core/recipes";

export const RECIPE_ID = "44444444-4444-4444-8444-444444444444";

const chickenAndRice = buildChickenAndRiceRecipe();

export const recipeComputed: RecipeComputed = computeRecipe({
  servings: chickenAndRice.servings,
  yieldGrams: chickenAndRice.yieldGrams,
  ingredients: chickenAndRice.ingredients,
});

type SummaryOverrides = {
  id?: string;
  name?: string;
  is_archived?: boolean;
};

/** A `recipes` row as PostgREST returns it for the library's lean columns. */
export const recipeSummaryRow = (overrides: SummaryOverrides = {}) => ({
  id: RECIPE_ID,
  name: "Chicken and rice",
  servings: 4,
  yield_grams: null,
  is_archived: false,
  computed: recipeComputed,
  ...overrides,
});

/** A `recipes` row with its `recipe_ingredients` embedded, as PostgREST returns it for one recipe. */
export const recipeDetailRow = (
  overrides: SummaryOverrides & { instructions?: string[] } = {},
) => ({
  ...recipeSummaryRow(overrides),
  instructions: overrides.instructions ?? ["Poach the chicken.", "Cook the rice.", "Serve."],
  recipe_ingredients: chickenAndRice.ingredients.map((ingredient, position) => ({
    ...ingredient,
    position,
  })),
});
