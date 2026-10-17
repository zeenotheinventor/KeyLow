import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { nutrientsOfSnapshot } from "../../src/diary";
import {
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_YIELD_GRAMS,
  buildRecipeIngredient,
  computeRecipe,
  recipeCardOf,
} from "../../src/recipes";
import { buildFood } from "../../src/testing";

import type { RecipeDraft, RecipeIngredient } from "../../src/recipes";

const ingredientArbitrary: fc.Arbitrary<RecipeIngredient> = fc
  .record({
    kcal: fc.double({ min: 1, max: 900, noNaN: true }),
    protein_g: fc.double({ min: 1, max: 100, noNaN: true }),
    quantity: fc.double({ min: 0.1, max: 500, noNaN: true }),
    unit: fc.constantFrom("g" as const, "oz" as const),
  })
  .map(({ kcal, protein_g, quantity, unit }) =>
    buildRecipeIngredient(buildFood({ kcal, protein_g }), { quantity, unit }),
  );

const ingredientsArbitrary = fc.array(ingredientArbitrary, { minLength: 1, maxLength: 8 });
const servingsArbitrary = fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS });
const cookedWeightArbitrary = fc.oneof(
  fc.constant(""),
  fc.integer({ min: 1, max: MAX_RECIPE_YIELD_GRAMS }).map(String),
);

const draftArbitrary: fc.Arbitrary<RecipeDraft> = fc
  .record({
    ingredients: ingredientsArbitrary,
    servings: servingsArbitrary.map(String),
    cookedWeight: cookedWeightArbitrary,
  })
  .map((fields) => ({ name: "Recipe", steps: [], ...fields }));

const closeTo = (actual: number, expected: number) =>
  Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected));

describe("recipeCardOf properties", () => {
  it("should multiply the per serving kcal by the servings to the total of the ingredients", () => {
    fc.assert(
      fc.property(draftArbitrary, (draft) => {
        const card = recipeCardOf(draft);
        const total = draft.ingredients.reduce(
          (sum, ingredient) => sum + (nutrientsOfSnapshot(ingredient.snapshot).kcal ?? 0),
          0,
        );

        expect(card).not.toBeNull();
        expect(closeTo((card?.perServing.kcal ?? Number.NaN) * Number(draft.servings), total)).toBe(
          true,
        );
      }),
    );
  });

  it("should never disagree with computeRecipe on the same input", () => {
    fc.assert(
      fc.property(draftArbitrary, (draft) => {
        const yieldGrams = draft.cookedWeight === "" ? null : Number(draft.cookedWeight);
        const computed = computeRecipe({
          servings: Number(draft.servings),
          yieldGrams,
          ingredients: draft.ingredients,
        });

        const card = recipeCardOf(draft);

        expect(card?.perServing).toEqual(computed.perServing);
        expect(card?.per100g).toEqual(computed.per100g);
        expect(card?.totalGrams).toBe(computed.totalGrams);
        expect(card?.per100gBasis).toBe(yieldGrams === null ? "raw" : "cooked");
        expect(card?.servingGrams).toBe(computed.effectiveGrams / Number(draft.servings));
      }),
    );
  });
});
