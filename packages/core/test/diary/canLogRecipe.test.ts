import { describe, expect, it } from "vitest";

import { canLogRecipe } from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary";
import type { RecipeComputed } from "../../src/recipes";

type CheckedRecipe = LoggableRecipe & { computed: RecipeComputed };

const chickenAndRice = (): CheckedRecipe => {
  const { servings, ingredients } = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Chicken and rice",
    servings,
    yield_grams: 1100,
    computed: computeRecipe({ servings, yieldGrams: 1100, ingredients }),
  };
};

const withPerServing = (recipe: CheckedRecipe, change: Partial<RecipeComputed["perServing"]>) => ({
  ...recipe,
  computed: { ...recipe.computed, perServing: { ...recipe.computed.perServing, ...change } },
});

describe("canLogRecipe", () => {
  it("should offer a recipe with a weight and every figure of a serving", () => {
    expect(canLogRecipe(chickenAndRice())).toBe(true);
  });

  it("should offer a recipe with no measured cooked weight, which weighs what its ingredients weigh", () => {
    const { servings, ingredients } = buildChickenAndRiceRecipe({ servings: 4 });
    const recipe: CheckedRecipe = {
      ...chickenAndRice(),
      yield_grams: null,
      computed: computeRecipe({ servings, yieldGrams: null, ingredients }),
    };

    expect(canLogRecipe(recipe)).toBe(true);
  });

  it("should not offer a recipe with no weight, because one serving of nothing is nothing", () => {
    const recipe = chickenAndRice();

    expect(canLogRecipe({ ...recipe, computed: { ...recipe.computed, effectiveGrams: 0 } })).toBe(
      false,
    );
  });

  it("should not offer a recipe with no servings", () => {
    expect(canLogRecipe({ ...chickenAndRice(), servings: 0 })).toBe(false);
  });

  it.each(["kcal", "protein_g", "carbs_g", "fat_g"] as const)(
    "should not offer a recipe whose serving has no %s",
    (missing) => {
      expect(canLogRecipe(withPerServing(chickenAndRice(), { [missing]: null }))).toBe(false);
    },
  );

  it("should still offer a recipe that lacks a value the row does not show", () => {
    expect(canLogRecipe(withPerServing(chickenAndRice(), { fibre_g: null }))).toBe(true);
  });
});
