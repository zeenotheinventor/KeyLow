import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MAX_RECIPE_INGREDIENTS,
  buildRecipeIngredient,
  normaliseSteps,
  recipeSchema,
  validateRecipeDraft,
} from "../../src/recipes";
import { buildFood } from "../../src/testing";

import type { RecipeDraftProblem } from "../../src/recipes";

const ingredient = buildRecipeIngredient(buildFood(), { quantity: 150, unit: "g" });

/** Hundredths, so the number is written in plain digits and a decimal point and never with an exponent. */
const hundredths = fc.integer({ min: -1000, max: 20_000_000 });
const text = (maximumLength: number) => fc.string({ unit: "binary", maxLength: maximumLength });

/** Text that is sometimes just under or over a bound, which random text rarely is. */
const textNearALimit = (limit: number) =>
  fc
    .tuple(fc.integer({ min: limit - 2, max: limit + 2 }), fc.constantFrom("", " ", "  \n"))
    .map(([length, padding]) => `${padding}${"x".repeat(length)}${padding}`);

describe("validateRecipeDraft", () => {
  it("should be ok exactly when the recipe schema accepts the values it hands back", () => {
    fc.assert(
      fc.property(
        fc.oneof(text(220), textNearALimit(200)),
        hundredths,
        fc.option(hundredths, { nil: null }),
        fc.array(fc.oneof(text(40), textNearALimit(1000)), { maxLength: 53 }),
        (name, servingsHundredths, yieldHundredths, steps) => {
          const servings = servingsHundredths / 100;
          const yieldGrams = yieldHundredths === null ? null : yieldHundredths / 100;
          const result = validateRecipeDraft({
            name,
            servings: String(servings),
            cookedWeight: yieldGrams === null ? "" : String(yieldGrams),
            ingredients: [ingredient],
            steps,
          });
          const accepted = recipeSchema.safeParse({
            name: name.trim(),
            servings,
            yield_grams: yieldGrams,
            instructions: normaliseSteps(steps),
            is_archived: false,
          }).success;

          expect(result.ok).toBe(accepted);
          if (result.ok) {
            expect(result.value).toEqual({
              name: name.trim(),
              servings,
              yieldGrams,
              steps: normaliseSteps(steps),
            });
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("should list each problem once and in a stable order whatever the draft", () => {
    const order: readonly RecipeDraftProblem[] = [
      "name_required",
      "name_too_long",
      "servings_invalid",
      "servings_too_many",
      "cooked_weight_invalid",
      "cooked_weight_too_large",
      "ingredients_none",
      "ingredients_too_many",
      "ingredient_invalid",
      "steps_too_many",
      "step_too_long",
    ];
    fc.assert(
      fc.property(
        text(30),
        text(8),
        text(8),
        fc.integer({ min: 0, max: MAX_RECIPE_INGREDIENTS + 1 }),
        fc.array(textNearALimit(1000), { maxLength: 3 }),
        (name, servings, cookedWeight, ingredientCount, steps) => {
          const result = validateRecipeDraft({
            name,
            servings,
            cookedWeight,
            ingredients: Array.from({ length: ingredientCount }, () => ingredient),
            steps,
          });
          const problems = result.ok ? [] : result.problems;

          expect(problems).toEqual(order.filter((code) => problems.includes(code)));
        },
      ),
    );
  });
});
