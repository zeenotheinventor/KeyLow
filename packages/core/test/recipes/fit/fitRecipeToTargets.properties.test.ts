import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildRecipeIngredient,
  computeRecipe,
  fitRecipeToTargets,
  isWithinTolerance,
} from "../../../src/recipes";
import { buildFood } from "../../../src/testing";

import type { FitIngredient, FitInput, FitNutrient, FitTarget } from "../../../src/recipes";

const NUTRIENTS: readonly FitNutrient[] = ["kcal", "protein_g", "carbs_g", "fat_g"];
const SLACK = 1e-6;
const GRID = 5;

const per100Arbitrary = fc.record({
  kcal: fc.integer({ min: 0, max: 900 }),
  protein_g: fc.integer({ min: 0, max: 60 }),
  fat_g: fc.integer({ min: 0, max: 100 }),
  carbs_g: fc.integer({ min: 0, max: 100 }),
  fibre_g: fc.integer({ min: 0, max: 20 }),
});

const ingredientArbitrary: fc.Arbitrary<FitIngredient> = fc.record({
  foodId: fc.uuid(),
  per100: per100Arbitrary,
  // Mostly whole 5 g steps, and sometimes under 10 g so the 5 g floor of the band is in play.
  grams: fc.oneof(
    { arbitrary: fc.integer({ min: 2, max: 120 }).map((fives) => fives * 5), weight: 3 },
    { arbitrary: fc.integer({ min: 1, max: 9 }), weight: 1 },
  ),
  locked: fc.boolean(),
});

const withOwnBounds: fc.Arbitrary<FitIngredient> = fc
  .tuple(
    ingredientArbitrary,
    fc.double({ min: 0.3, max: 1, noNaN: true }),
    fc.double({ min: 1, max: 3, noNaN: true }),
  )
  .map(([ingredient, lowShare, highShare]) => ({
    ...ingredient,
    minGrams: Math.max(1, Math.floor(ingredient.grams * lowShare)),
    maxGrams: Math.ceil(ingredient.grams * highShare),
  }));

const targetArbitrary: fc.Arbitrary<FitTarget> = fc.record(
  {
    kcal: fc.integer({ min: 0, max: 1500 }),
    protein_g: fc.integer({ min: 0, max: 150 }),
    carbs_g: fc.integer({ min: 0, max: 200 }),
    fat_g: fc.integer({ min: 0, max: 100 }),
  },
  { requiredKeys: [] },
);

const inputArbitrary = (ingredient: fc.Arbitrary<FitIngredient>): fc.Arbitrary<FitInput> =>
  fc.record({
    ingredients: fc.array(ingredient, { minLength: 1, maxLength: 7 }),
    servings: fc.integer({ min: 1, max: 6 }),
    target: targetArbitrary,
  });

/** Core's own figures for amounts, built the long way round with real foods and `computeRecipe`. */
const perServingByCore = (
  ingredients: readonly FitIngredient[],
  grams: readonly number[],
  servings: number,
) =>
  computeRecipe({
    servings,
    yieldGrams: null,
    ingredients: ingredients.map((ingredient, at) =>
      buildRecipeIngredient(
        buildFood({
          kcal: ingredient.per100.kcal,
          protein_g: ingredient.per100.protein_g,
          fat_g: ingredient.per100.fat_g,
          carbs_g: ingredient.per100.carbs_g,
          fibre_g: ingredient.per100.fibre_g,
        }),
        { quantity: grams[at] ?? 0, unit: "g" },
      ),
    ),
  }).perServing;

const defaultBand = (ingredient: FitIngredient) => ({
  low: Math.min(ingredient.grams, Math.max(5, ingredient.grams / 2)),
  high: Math.max(ingredient.grams, Math.min(1000, ingredient.grams * 2)),
});

const runs = { numRuns: 150 };

describe("fitRecipeToTargets properties", () => {
  it("never moves a locked ingredient", () => {
    fc.assert(
      fc.property(inputArbitrary(ingredientArbitrary), (input) => {
        const result = fitRecipeToTargets(input);
        input.ingredients.forEach((ingredient, at) => {
          if (ingredient.locked) {
            expect(result.ingredients[at]?.grams).toBe(ingredient.grams);
          }
        });
      }),
      runs,
    );
  });

  it("keeps every unlocked ingredient inside its default band", () => {
    fc.assert(
      fc.property(inputArbitrary(ingredientArbitrary), (input) => {
        const result = fitRecipeToTargets(input);
        input.ingredients.forEach((ingredient, at) => {
          const grams = result.ingredients[at]?.grams ?? 0;
          const { low, high } = defaultBand(ingredient);
          expect(grams).toBeGreaterThanOrEqual(low - SLACK);
          expect(grams).toBeLessThanOrEqual(high + SLACK);
        });
      }),
      runs,
    );
  });

  it("keeps every unlocked ingredient inside its own minimum and maximum", () => {
    fc.assert(
      fc.property(inputArbitrary(withOwnBounds), (input) => {
        const result = fitRecipeToTargets(input);
        input.ingredients.forEach((ingredient, at) => {
          const grams = result.ingredients[at]?.grams ?? 0;
          expect(grams).toBeGreaterThanOrEqual(ingredient.minGrams ?? 0);
          expect(grams).toBeLessThanOrEqual(ingredient.maxGrams ?? Number.POSITIVE_INFINITY);
        });
      }),
      runs,
    );
  });

  it("returns grams above 0 and in whole 5 g steps for whatever it moved", () => {
    fc.assert(
      fc.property(inputArbitrary(ingredientArbitrary), (input) => {
        const result = fitRecipeToTargets(input);
        input.ingredients.forEach((ingredient, at) => {
          const grams = result.ingredients[at]?.grams ?? 0;
          expect(grams).toBeGreaterThan(0);
          const { low, high } = defaultBand(ingredient);
          const bandHasAGridPoint = Math.ceil(low / GRID) <= Math.floor(high / GRID);
          if (grams !== ingredient.grams && bandHasAGridPoint) {
            expect(grams % GRID).toBe(0);
          }
        });
      }),
      runs,
    );
  });

  it("gives the same output for the same input", () => {
    fc.assert(
      fc.property(inputArbitrary(ingredientArbitrary), (input) => {
        expect(fitRecipeToTargets(input)).toEqual(fitRecipeToTargets(input));
      }),
      runs,
    );
  });

  it("says within exactly when core's own figures are in tolerance, and never fudges", () => {
    fc.assert(
      fc.property(inputArbitrary(ingredientArbitrary), (input) => {
        const result = fitRecipeToTargets(input);
        const byCore = perServingByCore(
          input.ingredients,
          result.ingredients.map(({ grams }) => grams),
          input.servings,
        );
        expect(isWithinTolerance(byCore, input.target)).toBe(result.status === "within");
        for (const nutrient of NUTRIENTS) {
          expect(result.perServing[nutrient] ?? 0).toBeCloseTo(byCore[nutrient] ?? 0, 6);
        }
      }),
      runs,
    );
  });

  it("explains an unreachable result with misses that really are out of tolerance", () => {
    fc.assert(
      fc.property(inputArbitrary(ingredientArbitrary), (input) => {
        const result = fitRecipeToTargets(input);
        const byCore = perServingByCore(
          input.ingredients,
          result.ingredients.map(({ grams }) => grams),
          input.servings,
        );
        if (result.status === "within") {
          expect(result.misses).toEqual([]);
          return;
        }
        expect(result.misses.length).toBeGreaterThan(0);
        for (const miss of result.misses) {
          expect(isWithinTolerance(byCore, { [miss.nutrient]: miss.target })).toBe(false);
          expect(miss.achieved).toBe(byCore[miss.nutrient]);
        }
      }),
      runs,
    );
  });

  it("returns an input that is already in tolerance unchanged", () => {
    fc.assert(
      fc.property(
        inputArbitrary(ingredientArbitrary),
        fc.double({ min: -0.9, max: 0.9, noNaN: true }),
        (input, share) => {
          const own = perServingByCore(
            input.ingredients,
            input.ingredients.map(({ grams }) => grams),
            input.servings,
          );
          const target: FitTarget = {
            kcal: (own.kcal ?? 0) + share * (own.kcal ?? 0) * 0.05,
            protein_g: Math.max(0, (own.protein_g ?? 0) + share * 5),
          };
          const result = fitRecipeToTargets({ ...input, target });
          expect(result.status).toBe("within");
          expect(result.ingredients.map(({ grams }) => grams)).toEqual(
            input.ingredients.map(({ grams }) => grams),
          );
        },
      ),
      runs,
    );
  });

  it("finds a fit whenever one exists on the 5 g grid", () => {
    fc.assert(
      fc.property(
        inputArbitrary(ingredientArbitrary),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 7, maxLength: 7 }),
        (input, shares) => {
          const planted = input.ingredients.map((ingredient, at) => {
            if (ingredient.locked) {
              return ingredient.grams;
            }
            const { low, high } = defaultBand(ingredient);
            const stepLow = Math.ceil(low / GRID);
            const stepHigh = Math.floor(high / GRID);
            if (stepLow > stepHigh) {
              return ingredient.grams;
            }
            return GRID * (stepLow + Math.round((shares[at] ?? 0) * (stepHigh - stepLow)));
          });
          const reachable = perServingByCore(input.ingredients, planted, input.servings);
          const target: FitTarget = {
            kcal: reachable.kcal ?? 0,
            protein_g: reachable.protein_g ?? 0,
            carbs_g: reachable.carbs_g ?? 0,
            fat_g: reachable.fat_g ?? 0,
          };
          expect(fitRecipeToTargets({ ...input, target }).status).toBe("within");
        },
      ),
      runs,
    );
  });
});
