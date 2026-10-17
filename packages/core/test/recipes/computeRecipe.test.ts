import { describe, expect, it } from "vitest";

import { NUTRITION_ENGINE_VERSION, nutrientsOfSnapshot } from "../../src/diary";
import { SPOON_PORTIONS } from "../../src/nutrition";
import { buildRecipeIngredient, computeRecipe, recipeComputedSchema } from "../../src/recipes";
import { buildChickenAndRiceRecipe, buildFood } from "../../src/testing";

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

const unknownNutrients = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
};

describe("computeRecipe", () => {
  describe("the chicken and rice golden", () => {
    const withYield = computeRecipe(buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 }));
    const withoutYield = computeRecipe(buildChickenAndRiceRecipe({ servings: 4 }));

    it("should total 1496.8 kcal, 126.5 g protein and 720 g raw", () => {
      expect(withYield.total.kcal).toBeCloseTo(1496.8, 9);
      expect(withYield.total.protein_g).toBeCloseTo(126.5, 9);
      expect(withYield.totalGrams).toBe(720);
    });

    it("should give 374.2 kcal per serving of four", () => {
      expect(withYield.perServing.kcal).toBeCloseTo(374.2, 9);
    });

    it("should give 136.07 kcal per 100 g of an 1100 g yield", () => {
      expect(withYield.effectiveGrams).toBe(1100);
      expect(withYield.per100g.kcal).toBeCloseTo(136.0727, 4);
      expect(withYield.per100g.kcal).toBeCloseTo((1496.8 / 1100) * 100, 9);
    });

    it("should use the raw 720 g when there is no yield", () => {
      expect(withoutYield.effectiveGrams).toBe(720);
      expect(withoutYield.totalGrams).toBe(720);
    });

    it("should come to 571.694 kcal for 275 g of a recipe with no yield", () => {
      const kcalOf275Grams =
        ((withoutYield.total.kcal ?? Number.NaN) * 275) / withoutYield.effectiveGrams;

      expect(kcalOf275Grams).toBeCloseTo(571.694, 3);
    });

    it("should not change the total or the serving when a yield is set", () => {
      expect(withYield.total).toEqual(withoutYield.total);
      expect(withYield.perServing).toEqual(withoutYield.perServing);
    });

    it("should record the version of the maths", () => {
      expect(withYield.engineVersion).toBe(NUTRITION_ENGINE_VERSION);
    });

    it("should produce a cache the computed schema accepts", () => {
      expect(recipeComputedSchema.parse(withYield)).toEqual(withYield);
    });
  });

  describe("a tablespoon ingredient", () => {
    const oil = buildFood({
      id: "00000000-0000-4000-8000-0000000000e1",
      name: "Test oil",
      density_g_per_ml: 0.92,
      kcal: 884,
      protein_g: 0,
      fat_g: 100,
      carbs_g: 0,
    });
    const ingredient = buildRecipeIngredient(oil, {
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
    });

    it("should have the numbers of its own snapshot", () => {
      const computed = computeRecipe({ servings: 1, yieldGrams: null, ingredients: [ingredient] });
      const own = nutrientsOfSnapshot(ingredient.snapshot);

      expect(computed.total).toEqual(own);
      expect(computed.total.kcal).toBeCloseTo(8.84 * 2 * 15 * 0.92, 9);
      expect(computed.totalGrams).toBe(ingredient.resolved_grams);
    });

    it("should use the density frozen in the snapshot, not the live food's", () => {
      const before = computeRecipe({ servings: 1, yieldGrams: null, ingredients: [ingredient] });

      const retuned = { ...oil, density_g_per_ml: 0.5 };
      const rebuilt = buildRecipeIngredient(retuned, {
        quantity: 2,
        unit: "portion",
        portion: tablespoon,
      });
      const after = computeRecipe({ servings: 1, yieldGrams: null, ingredients: [ingredient] });

      expect(ingredient.snapshot.density).toBe(0.92);
      expect(after).toEqual(before);
      expect(rebuilt.resolved_grams).not.toBe(ingredient.resolved_grams);
    });
  });

  describe("optional nutrients", () => {
    it("should leave an optional key out when no ingredient records it", () => {
      const { total } = computeRecipe(buildChickenAndRiceRecipe());

      expect(Object.keys(total).sort()).toEqual(
        ["carbs_g", "fat_g", "fibre_g", "kcal", "protein_g"].sort(),
      );
    });

    it("should sum an optional key that only some ingredients record", () => {
      const recipe = buildChickenAndRiceRecipe();
      const salty = buildFood({ kcal: 0, salt_g: 2 });
      const ingredients = [
        ...recipe.ingredients,
        buildRecipeIngredient(salty, { quantity: 50, unit: "g" }),
      ];

      const computed = computeRecipe({ ...recipe, ingredients });

      expect(computed.total.salt_g).toBeCloseTo(1, 9);
      expect(computed.perServing.salt_g).toBeCloseTo(0.25, 9);
    });
  });

  describe("a recipe with no ingredients", () => {
    it("should compute to nothing known and no grams", () => {
      const computed = computeRecipe({ servings: 4, yieldGrams: null, ingredients: [] });

      expect(computed.total).toStrictEqual(unknownNutrients);
      expect(computed.perServing).toStrictEqual(unknownNutrients);
      expect(computed.per100g).toStrictEqual(unknownNutrients);
      expect(computed.totalGrams).toBe(0);
      expect(computed.effectiveGrams).toBe(0);
    });

    it("should keep the yield as the effective grams but still know nothing per 100 g", () => {
      const computed = computeRecipe({ servings: 4, yieldGrams: 300, ingredients: [] });

      expect(computed.effectiveGrams).toBe(300);
      expect(computed.totalGrams).toBe(0);
      expect(computed.per100g).toStrictEqual(unknownNutrients);
    });

    it("should be a cache the computed schema accepts", () => {
      const computed = computeRecipe({ servings: 4, yieldGrams: null, ingredients: [] });

      expect(recipeComputedSchema.safeParse(computed).success).toBe(true);
    });
  });

  describe("when the recipe weighs nothing", () => {
    const food = buildFood({ kcal: 250 });
    const weightless = [buildRecipeIngredient(food, { quantity: 0, unit: "g" })];

    it("should not divide by zero for the per 100 g figures", () => {
      const computed = computeRecipe({ servings: 2, yieldGrams: null, ingredients: weightless });

      expect(computed.effectiveGrams).toBe(0);
      expect(computed.per100g).toStrictEqual(unknownNutrients);
      expect(computed.total.kcal).toBe(0);
      expect(computed.perServing.kcal).toBe(0);
    });
  });

  describe("fractional servings", () => {
    it("should divide by the fraction as by a whole number", () => {
      const computed = computeRecipe(buildChickenAndRiceRecipe({ servings: 2.5 }));

      expect(computed.perServing.kcal).toBeCloseTo(1496.8 / 2.5, 9);
    });
  });

  describe("invalid servings and yield", () => {
    const { ingredients } = buildChickenAndRiceRecipe();

    it.each([
      { servings: 0 },
      { servings: -2 },
      { servings: Number.NaN },
      { servings: Number.POSITIVE_INFINITY },
    ])("should throw a RangeError for $servings servings", ({ servings }) => {
      expect(() => computeRecipe({ servings, yieldGrams: null, ingredients })).toThrow(RangeError);
    });

    it.each([
      { yieldGrams: 0 },
      { yieldGrams: -300 },
      { yieldGrams: Number.NaN },
      { yieldGrams: Number.POSITIVE_INFINITY },
    ])("should throw a RangeError for a yield of $yieldGrams", ({ yieldGrams }) => {
      expect(() => computeRecipe({ servings: 4, yieldGrams, ingredients })).toThrow(RangeError);
    });

    it("should state the rule and never the value", () => {
      const badServings = () => computeRecipe({ servings: -7321, yieldGrams: null, ingredients });
      const badYield = () => computeRecipe({ servings: 4, yieldGrams: -8123, ingredients });

      expect(badServings).toThrow("Servings must be a finite number above 0");
      expect(badServings).not.toThrow(/7321/);
      expect(badYield).toThrow("The yield must be a finite number above 0");
      expect(badYield).not.toThrow(/8123/);
    });
  });

  it("should not change the ingredients it is given", () => {
    const recipe = buildChickenAndRiceRecipe();
    const before = structuredClone(recipe.ingredients);

    computeRecipe(recipe);

    expect(recipe.ingredients).toEqual(before);
  });
});
