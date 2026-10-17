import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildRecipeIngredient, removeIngredient, restoreIngredient } from "../../src/recipes";
import { buildFood } from "../../src/testing";

import type { RecipeIngredient } from "../../src/recipes";

const ingredientArbitrary: fc.Arbitrary<RecipeIngredient> = fc
  .record({
    kcal: fc.double({ min: 1, max: 900, noNaN: true }),
    quantity: fc.double({ min: 0.1, max: 500, noNaN: true }),
  })
  .map(({ kcal, quantity }) => buildRecipeIngredient(buildFood({ kcal }), { quantity, unit: "g" }));

const listWithAnIndex = fc
  .array(ingredientArbitrary, { minLength: 1, maxLength: 8 })
  .chain((list) => fc.record({ list: fc.constant(list), index: fc.nat({ max: list.length - 1 }) }));

describe("the ingredient list properties", () => {
  it("should give back the original list when an ingredient is removed and restored at its place", () => {
    fc.assert(
      fc.property(listWithAnIndex, ({ list, index }) => {
        const removed = list[index];
        if (removed === undefined) {
          throw new Error("The index is within the list");
        }

        expect(restoreIngredient(removeIngredient(list, index), index, removed)).toEqual(list);
      }),
    );
  });
});
