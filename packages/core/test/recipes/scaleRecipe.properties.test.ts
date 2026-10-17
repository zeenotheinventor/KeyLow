import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { SPOON_PORTIONS } from "../../src/nutrition";
import {
  MAX_RECIPE_SERVINGS,
  buildRecipeIngredient,
  computeRecipe,
  scaleFactor,
  scaleIngredientAmount,
  scaleYield,
} from "../../src/recipes";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { RecipeIngredient } from "../../src/recipes";
import type { NullableNutrients } from "../../src/schemas";

const per100Amount = fc.double({ min: 1, max: 900, noNaN: true });
const quantityAmount = fc.double({ min: 0.1, max: 500, noNaN: true });
const factorAmount = fc.double({ min: 0.001, max: 1000, noNaN: true });
const wholeServings = fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS });
const recipeServings = fc.double({ min: 0.5, max: 100, noNaN: true });

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must include a teaspoon and a tablespoon");
}
const gramPortion = buildFoodPortion({ label: "1 medium", grams: 110 });

const ingredientArbitrary: fc.Arbitrary<RecipeIngredient> = fc
  .record({
    kcal: per100Amount,
    protein_g: per100Amount,
    quantity: quantityAmount,
    amount: fc.constantFrom(
      { unit: "g" as const },
      { unit: "ml" as const },
      { unit: "oz" as const },
      { unit: "fl_oz" as const },
      { unit: "portion" as const, portion: gramPortion },
      { unit: "portion" as const, portion: teaspoon },
      { unit: "portion" as const, portion: tablespoon },
    ),
  })
  .map(({ kcal, protein_g, quantity, amount }) =>
    buildRecipeIngredient(buildFood({ kcal, protein_g, density_g_per_ml: 0.92 }), {
      quantity,
      ...amount,
    }),
  );

const ingredientsArbitrary = fc.array(ingredientArbitrary, { minLength: 1, maxLength: 6 });

const closeTo = (actual: number, expected: number, tolerance = 1e-9) =>
  Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));

const scaledIngredient = (ingredient: RecipeIngredient, factor: number): RecipeIngredient => {
  const scaled = scaleIngredientAmount(ingredient, factor);
  return {
    ...ingredient,
    quantity: scaled.quantity,
    resolved_grams: scaled.resolvedGrams,
    snapshot: {
      ...ingredient.snapshot,
      quantity: scaled.quantity,
      resolvedGrams: scaled.resolvedGrams,
    },
  };
};

const nutrientKeys = [
  "kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "fibre_g",
] as const satisfies readonly (keyof NullableNutrients)[];

describe("scaling a recipe properties", () => {
  it("should leave an ingredient's amount unchanged at factor 1", () => {
    fc.assert(
      fc.property(ingredientArbitrary, (ingredient) => {
        expect(scaleIngredientAmount(ingredient, 1)).toEqual({
          unit: ingredient.unit,
          quantity: ingredient.quantity,
          resolvedGrams: ingredient.resolved_grams,
          portion: ingredient.snapshot.portion,
        });
      }),
    );
  });

  it("should be linear: scaling by one factor and then another is scaling by their product", () => {
    fc.assert(
      fc.property(ingredientArbitrary, factorAmount, factorAmount, (ingredient, first, second) => {
        const twice = scaleIngredientAmount(scaledIngredient(ingredient, first), second);
        const once = scaleIngredientAmount(ingredient, first * second);

        expect(closeTo(twice.quantity, once.quantity)).toBe(true);
        expect(closeTo(twice.resolvedGrams, once.resolvedGrams)).toBe(true);
      }),
    );
  });

  it("should scale the grams by the same ratio as the quantity", () => {
    fc.assert(
      fc.property(ingredientArbitrary, factorAmount, (ingredient, factor) => {
        const scaled = scaleIngredientAmount(ingredient, factor);

        expect(closeTo(scaled.quantity / ingredient.quantity, factor)).toBe(true);
        expect(closeTo(scaled.resolvedGrams / ingredient.resolved_grams, factor)).toBe(true);
      }),
    );
  });

  it("should keep the unit and the portion of the ingredient", () => {
    fc.assert(
      fc.property(ingredientArbitrary, factorAmount, (ingredient, factor) => {
        const scaled = scaleIngredientAmount(ingredient, factor);

        expect(scaled.unit).toBe(ingredient.unit);
        expect(scaled.portion).toEqual(ingredient.snapshot.portion);
      }),
    );
  });

  it("should not change the ingredient it is given", () => {
    fc.assert(
      fc.property(ingredientArbitrary, factorAmount, (ingredient, factor) => {
        const before = structuredClone(ingredient);

        scaleIngredientAmount(ingredient, factor);

        expect(ingredient).toEqual(before);
      }),
    );
  });

  it("should leave the nutrition per serving and per 100 g unchanged when the servings and cooked weight scale with it", () => {
    fc.assert(
      fc.property(
        ingredientsArbitrary,
        recipeServings,
        wholeServings,
        fc.option(fc.double({ min: 1, max: 5000, noNaN: true }), { nil: null }),
        (ingredients, servings, chosen, yieldGrams) => {
          const factor = scaleFactor(chosen, servings);
          const original = computeRecipe({ servings, yieldGrams, ingredients });
          const scaled = computeRecipe({
            servings: chosen,
            yieldGrams: scaleYield(yieldGrams, factor),
            ingredients: ingredients.map((ingredient) => scaledIngredient(ingredient, factor)),
          });

          for (const key of nutrientKeys) {
            const originalServing = original.perServing[key] ?? 0;
            const originalPer100 = original.per100g[key] ?? 0;

            expect(closeTo(scaled.perServing[key] ?? 0, originalServing)).toBe(true);
            expect(closeTo(scaled.per100g[key] ?? 0, originalPer100)).toBe(true);
          }
        },
      ),
    );
  });
});
