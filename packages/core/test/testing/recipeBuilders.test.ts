import { describe, expect, it } from "vitest";

import { recipeIngredientSchema } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

describe("buildChickenAndRiceRecipe", () => {
  it("should give the chicken, rice and oil foods the golden's per 100 g values", () => {
    const { foods } = buildChickenAndRiceRecipe();

    expect([foods.chicken.kcal, foods.chicken.protein_g]).toEqual([120, 22.5]);
    expect([foods.rice.kcal, foods.rice.protein_g]).toEqual([360, 7]);
    expect([foods.oil.kcal, foods.oil.protein_g]).toEqual([884, 0]);
  });

  it("should list 500 g chicken, 200 g rice and 20 g oil, in that order", () => {
    const { foods, ingredients } = buildChickenAndRiceRecipe();

    expect(
      ingredients.map((ingredient) => [ingredient.food_id, ingredient.resolved_grams]),
    ).toEqual([
      [foods.chicken.id, 500],
      [foods.rice.id, 200],
      [foods.oil.id, 20],
    ]);
  });

  it("should give the three foods different ids", () => {
    const { foods } = buildChickenAndRiceRecipe();

    expect(new Set([foods.chicken.id, foods.rice.id, foods.oil.id]).size).toBe(3);
  });

  it("should build ingredient rows the schema accepts", () => {
    const { ingredients } = buildChickenAndRiceRecipe();

    expect(
      ingredients.every((ingredient) => recipeIngredientSchema.safeParse(ingredient).success),
    ).toBe(true);
  });

  it("should serve four servings with no yield unless told otherwise", () => {
    const recipe = buildChickenAndRiceRecipe();

    expect([recipe.servings, recipe.yieldGrams]).toEqual([4, null]);
  });

  it("should take the servings and the yield as overrides", () => {
    const recipe = buildChickenAndRiceRecipe({ servings: 2.5, yieldGrams: 1100 });

    expect([recipe.servings, recipe.yieldGrams]).toEqual([2.5, 1100]);
  });
});
