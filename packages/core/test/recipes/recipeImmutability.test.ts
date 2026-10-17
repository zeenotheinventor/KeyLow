import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { SPOON_PORTIONS } from "../../src/nutrition";
import {
  buildRecipeIngredient,
  computeRecipe,
  recipeComputedSchema,
  recipeIngredientSchema,
} from "../../src/recipes";
import { buildChickenAndRiceRecipe, buildFood, buildFoodPortion } from "../../src/testing";

import type { RecipeComputed, RecipeIngredient, RecipeIngredientInput } from "../../src/recipes";
import type { NullableNutrients } from "../../src/schemas";

/** What the database does to jsonb: serialise it and read it back, here through the ingredient schema. */
const throughJsonb = (ingredients: readonly RecipeIngredient[]): RecipeIngredient[] =>
  ingredients.map((ingredient) =>
    recipeIngredientSchema.parse(JSON.parse(JSON.stringify(ingredient))),
  );

const expectNutrientsBitForBit = (actual: NullableNutrients, expected: NullableNutrients) => {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  const actualByKey = new Map(Object.entries(actual));
  for (const [key, value] of Object.entries(expected)) {
    expect(Object.is(actualByKey.get(key), value), key).toBe(true);
  }
};

const expectBitForBitEqual = (actual: RecipeComputed, expected: RecipeComputed) => {
  expectNutrientsBitForBit(actual.total, expected.total);
  expectNutrientsBitForBit(actual.perServing, expected.perServing);
  expectNutrientsBitForBit(actual.per100g, expected.per100g);
  expect(Object.is(actual.totalGrams, expected.totalGrams)).toBe(true);
  expect(Object.is(actual.effectiveGrams, expected.effectiveGrams)).toBe(true);
  expect(actual.engineVersion).toBe(expected.engineVersion);
};

const [, tablespoon] = SPOON_PORTIONS;
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

describe("the recipe immutability contract", () => {
  it("should compute the same recipe bit for bit after a jsonb round trip of the ingredients", () => {
    const recipe = buildChickenAndRiceRecipe({ servings: 3, yieldGrams: 1034.7 });
    const stored = throughJsonb(recipe.ingredients);

    expectBitForBitEqual(computeRecipe({ ...recipe, ingredients: stored }), computeRecipe(recipe));
  });

  it("should compute the same recipe bit for bit after a jsonb round trip of the cache", () => {
    const computed = computeRecipe(buildChickenAndRiceRecipe({ servings: 3, yieldGrams: 1034.7 }));

    expectBitForBitEqual(
      recipeComputedSchema.parse(JSON.parse(JSON.stringify(computed))),
      computed,
    );
  });

  it("should not change when the food an ingredient was built from is edited in place", () => {
    const recipe = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });
    const before = computeRecipe(recipe);

    recipe.foods.chicken.kcal = 1;
    recipe.foods.chicken.name = "Something else";
    recipe.foods.oil.density_g_per_ml = 0.1;
    recipe.foods.rice.protein_g = null;

    expectBitForBitEqual(computeRecipe(recipe), before);
  });

  it("should hold for any food, amount and unit, including portions and spoons", () => {
    const amount = fc.double({ min: 0, max: 900, noNaN: true });
    const optional = fc.option(amount, { nil: null });
    const quantity = fc.double({ min: 0.01, max: 200, noNaN: true });
    const portionSize = fc.double({ min: 1, max: 100, noNaN: true });
    const choice = fc.record({
      unit: fc.constantFrom("g", "ml", "oz", "fl_oz", "portion"),
      spoon: fc.boolean(),
      isMillilitres: fc.boolean(),
      size: portionSize,
      quantity,
    });
    const foodBasis = fc.record({
      kcal: amount,
      protein_g: optional,
      sat_fat_g: optional,
      basis: fc.constantFrom("per_100g", "per_100ml"),
      density_g_per_ml: fc.double({ min: 0.5, max: 3, noNaN: true }),
    });
    fc.assert(
      fc.property(
        fc.array(fc.tuple(foodBasis, choice), { minLength: 1, maxLength: 6 }),
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        fc.option(fc.double({ min: 1, max: 100000, noNaN: true }), { nil: null }),
        (rows, servings, yieldGrams) => {
          const ingredients = rows.map(([foodFields, chosen]) => {
            const input: RecipeIngredientInput =
              chosen.unit !== "portion"
                ? { quantity: chosen.quantity, unit: chosen.unit }
                : {
                    quantity: chosen.quantity,
                    unit: "portion",
                    portion: chosen.spoon
                      ? tablespoon
                      : buildFoodPortion(
                          chosen.isMillilitres
                            ? { label: "Portion", grams: null, ml: chosen.size }
                            : { label: "Portion", grams: chosen.size, ml: null },
                        ),
                  };
            return buildRecipeIngredient(buildFood(foodFields), input);
          });

          expectBitForBitEqual(
            computeRecipe({ servings, yieldGrams, ingredients: throughJsonb(ingredients) }),
            computeRecipe({ servings, yieldGrams, ingredients }),
          );
        },
      ),
    );
  });
});
