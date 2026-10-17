import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { expect } from "vitest";

import { keys } from "../../src/queryKeys";

import type { RecipeSave } from "../../src/repos/recipeWrites";
import type { QueryClient } from "@tanstack/react-query";

const chickenAndRice = buildChickenAndRiceRecipe();

/** A valid save: the chicken, rice and oil recipe with three steps. */
export const chickenAndRiceSave = (overrides: Partial<RecipeSave> = {}): RecipeSave => ({
  name: "Chicken and rice",
  servings: 4,
  yieldGrams: null,
  ingredients: chickenAndRice.ingredients,
  steps: ["Poach the chicken.", "Cook the rice.", "Serve."],
  ...overrides,
});

/** A save the schema refuses, because the builder allows the amount of 0 that the schema does not. */
export const saveWithBadIngredient = (): RecipeSave =>
  chickenAndRiceSave({
    ingredients: [buildRecipeIngredient(chickenAndRice.foods.oil, { quantity: 0, unit: "g" })],
  });

const diaryKeys = [
  keys.diary.day("2026-10-14"),
  keys.diary.week("2026-10-12"),
  keys.diary.entry("77777777-7777-4777-8777-777777777777"),
  keys.diary.completeDays("2026-10"),
  keys.diary.recentFoods,
];

/**
 * Puts something in every kind of diary query and returns a check that none of them was written to or
 * marked stale since. A recipe write must leave the diary alone: a past entry never changes when a
 * recipe does.
 */
export function seedDiaryQueries(queryClient: QueryClient) {
  for (const key of diaryKeys) {
    queryClient.setQueryData(key, { seeded: key.join("/") });
  }

  return () => {
    for (const key of diaryKeys) {
      expect(queryClient.getQueryData(key)).toEqual({ seeded: key.join("/") });
      expect(queryClient.getQueryState(key)).toMatchObject({
        dataUpdateCount: 1,
        isInvalidated: false,
      });
    }
  };
}
