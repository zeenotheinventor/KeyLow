import { describe, expect, it } from "vitest";

import { buildRecipeLogEntry, previewRecipeAmount, recipeAmountStart } from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe, RecipeAmount } from "../../src/diary";

const when = { loggedAt: "2026-10-17T12:30:00+01:00", localDate: "2026-10-17" } as const;

const chickenAndRice = (yieldGrams: number | null): LoggableRecipe => {
  const { servings, ingredients } = buildChickenAndRiceRecipe({
    servings: 4,
    ...(yieldGrams === null ? {} : { yieldGrams }),
  });
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Chicken and rice",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

describe("recipeAmountStart", () => {
  it("should open on one serving", () => {
    expect(recipeAmountStart()).toEqual({ quantity: 1, unit: "serving" });
  });
});

describe("previewRecipeAmount", () => {
  it.each([
    { name: "one serving", amount: { quantity: 1, unit: "serving" } },
    { name: "1.5 servings", amount: { quantity: 1.5, unit: "serving" } },
    { name: "275 g of cooked weight", amount: { quantity: 275, unit: "g" } },
    { name: "a third of a serving", amount: { quantity: 1 / 3, unit: "serving" } },
    { name: "0.1 g of cooked weight", amount: { quantity: 0.1, unit: "g" } },
  ] as const satisfies readonly { name: string; amount: RecipeAmount }[])(
    "should give $name the values of buildRecipeLogEntry, to the digit",
    ({ amount }) => {
      for (const recipe of [chickenAndRice(1100), chickenAndRice(null)]) {
        const values = previewRecipeAmount(recipe, amount);
        const entry = buildRecipeLogEntry({ recipe, ...amount, ...when });

        expect(values).not.toBeNull();
        expect(values?.kcal).toBe(entry.nutrients.kcal);
        expect(values?.protein_g).toBe(entry.nutrients.protein_g);
        expect(values?.carbs_g).toBe(entry.nutrients.carbs_g);
        expect(values?.fat_g).toBe(entry.nutrients.fat_g);
      }
    },
  );

  it("should come to 374.2 kcal for one serving", () => {
    expect(
      previewRecipeAmount(chickenAndRice(1100), { quantity: 1, unit: "serving" })?.kcal,
    ).toBeCloseTo(374.2, 9);
  });

  it("should carry only the values the hero needs", () => {
    const values = previewRecipeAmount(chickenAndRice(1100), recipeAmountStart());

    expect(Object.keys(values ?? {}).sort()).toEqual(["carbs_g", "fat_g", "kcal", "protein_g"]);
  });

  it("should leave an unknown value null", () => {
    const recipe = chickenAndRice(1100);
    const unknown = {
      ...recipe,
      computed: { ...recipe.computed, total: { ...recipe.computed.total, protein_g: null } },
    };

    expect(previewRecipeAmount(unknown, { quantity: 1, unit: "serving" })?.protein_g).toBeNull();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE])(
    "should give no values for a quantity of %s",
    (quantity) => {
      expect(previewRecipeAmount(chickenAndRice(1100), { quantity, unit: "serving" })).toBeNull();
      expect(previewRecipeAmount(chickenAndRice(1100), { quantity, unit: "g" })).toBeNull();
    },
  );

  it("should give no values for a recipe that cannot be logged, instead of throwing", () => {
    const recipe = chickenAndRice(1100);

    expect(previewRecipeAmount({ ...recipe, servings: 0 }, recipeAmountStart())).toBeNull();
    expect(
      previewRecipeAmount(
        { ...recipe, computed: { ...recipe.computed, effectiveGrams: 0 } },
        { quantity: 100, unit: "g" },
      ),
    ).toBeNull();
  });
});
