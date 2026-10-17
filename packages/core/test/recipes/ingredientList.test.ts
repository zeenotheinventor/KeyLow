import { describe, expect, it } from "vitest";

import {
  MAX_RECIPE_INGREDIENTS,
  addIngredient,
  removeIngredient,
  replaceIngredient,
  restoreIngredient,
} from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { RecipeIngredient } from "../../src/recipes";

const [chicken, rice, oil] = buildChickenAndRiceRecipe().ingredients;
if (chicken === undefined || rice === undefined || oil === undefined) {
  throw new Error("The golden recipe must have three ingredients");
}
const extra: RecipeIngredient = { ...oil, quantity: 5, resolved_grams: 5 };

const messageOf = (action: () => unknown): string => {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "";
};

const holdsNoRecipeValue = (message: string): boolean =>
  message !== "" && !/\d/.test(message) && !message.includes(chicken.food_id);

const frozen = (ingredients: RecipeIngredient[]): readonly RecipeIngredient[] =>
  Object.freeze([...ingredients]);

describe("addIngredient", () => {
  it.each([
    { name: "to an empty list", list: [], expected: [extra] },
    { name: "to the end of a list", list: [chicken, rice], expected: [chicken, rice, extra] },
  ])("should append an ingredient $name", ({ list, expected }) => {
    expect(addIngredient(frozen(list), extra)).toEqual(expected);
  });

  it("should accept the hundredth ingredient", () => {
    const ninetyNine = Array.from({ length: MAX_RECIPE_INGREDIENTS - 1 }, () => chicken);

    expect(addIngredient(ninetyNine, extra)).toHaveLength(MAX_RECIPE_INGREDIENTS);
  });

  it("should refuse an ingredient beyond the limit with a RangeError that names no recipe value", () => {
    const full = Array.from({ length: MAX_RECIPE_INGREDIENTS }, () => chicken);

    expect(() => addIngredient(full, extra)).toThrow(RangeError);
    expect(() => addIngredient(full, extra)).toThrow(String(MAX_RECIPE_INGREDIENTS));
    expect(() => addIngredient(full, extra)).not.toThrow(/Chicken|500/);
  });

  it("should not change the list it was given", () => {
    const list = frozen([chicken, rice]);

    const result = addIngredient(list, extra);

    expect(result).not.toBe(list);
    expect(list).toEqual([chicken, rice]);
  });
});

describe("replaceIngredient", () => {
  it("should state the rule in the RangeError and hold no recipe value", () => {
    expect(
      holdsNoRecipeValue(
        messageOf(() => replaceIngredient(frozen([chicken, rice, oil]), 99, extra)),
      ),
    ).toBe(true);
  });

  it.each([
    { name: "at the start", index: 0, expected: [extra, rice, oil] },
    { name: "in the middle", index: 1, expected: [chicken, extra, oil] },
    { name: "at the end", index: 2, expected: [chicken, rice, extra] },
  ])("should replace the ingredient $name", ({ index, expected }) => {
    expect(replaceIngredient(frozen([chicken, rice, oil]), index, extra)).toEqual(expected);
  });

  it.each([-1, 3, 1.5, Number.NaN])("should throw a RangeError for the index %s", (index) => {
    expect(() => replaceIngredient(frozen([chicken, rice, oil]), index, extra)).toThrow(RangeError);
  });

  it("should throw a RangeError for any index in an empty list", () => {
    expect(() => replaceIngredient([], 0, extra)).toThrow(RangeError);
  });

  it("should not change the list it was given", () => {
    const list = frozen([chicken, rice, oil]);

    replaceIngredient(list, 1, extra);

    expect(list).toEqual([chicken, rice, oil]);
  });
});

describe("removeIngredient", () => {
  it("should state the rule in the RangeError and hold no recipe value", () => {
    expect(
      holdsNoRecipeValue(messageOf(() => removeIngredient(frozen([chicken, rice, oil]), 99))),
    ).toBe(true);
  });

  it.each([
    { name: "at the start", index: 0, expected: [rice, oil] },
    { name: "in the middle", index: 1, expected: [chicken, oil] },
    { name: "at the end", index: 2, expected: [chicken, rice] },
  ])("should remove the ingredient $name", ({ index, expected }) => {
    expect(removeIngredient(frozen([chicken, rice, oil]), index)).toEqual(expected);
  });

  it("should leave an empty list when the only ingredient is removed", () => {
    expect(removeIngredient(frozen([chicken]), 0)).toEqual([]);
  });

  it.each([-1, 3, 1.5, Number.NaN])("should throw a RangeError for the index %s", (index) => {
    expect(() => removeIngredient(frozen([chicken, rice, oil]), index)).toThrow(RangeError);
  });

  it("should not change the list it was given", () => {
    const list = frozen([chicken, rice, oil]);

    removeIngredient(list, 0);

    expect(list).toEqual([chicken, rice, oil]);
  });
});

describe("restoreIngredient", () => {
  it("should state the rule in the RangeError and hold no recipe value", () => {
    expect(
      holdsNoRecipeValue(messageOf(() => restoreIngredient(frozen([chicken, rice]), 99, extra))),
    ).toBe(true);
  });

  it.each([
    { name: "at the start", index: 0, expected: [extra, chicken, rice] },
    { name: "in the middle", index: 1, expected: [chicken, extra, rice] },
    {
      name: "at the end, where the length is the index",
      index: 2,
      expected: [chicken, rice, extra],
    },
  ])("should put an ingredient back $name", ({ index, expected }) => {
    expect(restoreIngredient(frozen([chicken, rice]), index, extra)).toEqual(expected);
  });

  it("should put an ingredient into an empty list at index 0", () => {
    expect(restoreIngredient([], 0, extra)).toEqual([extra]);
  });

  it.each([-1, 3, 1.5, Number.NaN])("should throw a RangeError for the index %s", (index) => {
    expect(() => restoreIngredient(frozen([chicken, rice]), index, extra)).toThrow(RangeError);
  });

  it("should refuse to grow a full list", () => {
    const full = Array.from({ length: MAX_RECIPE_INGREDIENTS }, () => chicken);

    expect(() => restoreIngredient(full, 0, extra)).toThrow(RangeError);
  });

  it("should bring back the ingredient that removeIngredient took out", () => {
    const list = frozen([chicken, rice, oil]);

    expect(restoreIngredient(removeIngredient(list, 1), 1, rice)).toEqual(list);
  });

  it("should not change the list it was given", () => {
    const list = frozen([chicken, rice]);

    restoreIngredient(list, 1, extra);

    expect(list).toEqual([chicken, rice]);
  });
});
