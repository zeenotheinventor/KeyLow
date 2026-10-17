import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MAX_RECIPE_SERVINGS,
  enteredViewServings,
  recipeViewOf,
  stepViewServings,
} from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { StoredRecipe } from "../../src/recipes";

const ingredients = buildChickenAndRiceRecipe().ingredients;

const recipeOf = (
  servings: number,
  yieldGrams: number | null,
  instructions: string[],
): StoredRecipe => ({
  name: "Chicken and rice",
  servings,
  yield_grams: yieldGrams,
  instructions,
  ingredients,
});

const recipeArbitrary = fc.record({
  servings: fc.oneof(
    fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS }),
    fc.integer({ min: 1, max: 200 }).map((halves) => halves / 2),
  ),
  yieldGrams: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: null }),
  instructions: fc.array(fc.string({ minLength: 1 }), { maxLength: 3 }),
});

const typedText = fc.oneof(
  fc.string(),
  fc.integer({ min: -5, max: 1100 }).map(String),
  fc.integer({ min: 1, max: 200 }).map((halves) => String(halves / 2)),
);

describe("recipeViewOf properties", () => {
  it("should never throw for a number that enteredViewServings accepts", () => {
    fc.assert(
      fc.property(recipeArbitrary, typedText, (fields, text) => {
        const recipe = recipeOf(fields.servings, fields.yieldGrams, fields.instructions);
        const chosen = enteredViewServings(text, recipe.servings);
        if (chosen === null) {
          return;
        }

        expect(() => recipeViewOf(recipe, chosen)).not.toThrow();
      }),
    );
  });

  it("should never throw for a number a step reaches from the recipe's own servings", () => {
    fc.assert(
      fc.property(recipeArbitrary, fc.constantFrom("plus", "minus"), (fields, direction) => {
        const recipe = recipeOf(fields.servings, fields.yieldGrams, fields.instructions);
        const chosen = stepViewServings(recipe.servings, direction);
        if (chosen === null) {
          return;
        }

        expect(() => recipeViewOf(recipe, chosen)).not.toThrow();
      }),
    );
  });

  it("should be scaled exactly when the servings differ from the recipe's own", () => {
    fc.assert(
      fc.property(
        recipeArbitrary,
        fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS }),
        (fields, chosen) => {
          const recipe = recipeOf(fields.servings, fields.yieldGrams, fields.instructions);
          const view = recipeViewOf(recipe, chosen);

          expect(view.isScaled).toBe(chosen !== recipe.servings);
          expect(view.resetLabel === null).toBe(!view.isScaled);
          expect(view.stepsNote === null).toBe(!view.isScaled || recipe.instructions.length === 0);
        },
      ),
    );
  });

  it("should give one caption per ingredient, and the recipe's own servings for a null choice", () => {
    fc.assert(
      fc.property(recipeArbitrary, (fields) => {
        const recipe = recipeOf(fields.servings, fields.yieldGrams, fields.instructions);
        const view = recipeViewOf(recipe, null);

        expect(view.servings).toBe(recipe.servings);
        expect(view.isScaled).toBe(false);
        expect(view.ingredients).toHaveLength(ingredients.length);
      }),
    );
  });
});
