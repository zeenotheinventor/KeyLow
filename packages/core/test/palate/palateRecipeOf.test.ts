import { describe, expect, it } from "vitest";

import { palateRecipeOf } from "../../src/palate";

describe("palateRecipeOf", () => {
  it("should give a recipe the weight of one serving", () => {
    expect(palateRecipeOf({ id: "r", name: "Stew", servings: 4, yield_grams: 1600 })).toEqual({
      id: "r",
      name: "Stew",
      servingGrams: 400,
    });
  });

  it("should give a recipe with no weight no serving weight", () => {
    expect(
      palateRecipeOf({ id: "r", name: "Stew", servings: 4, yield_grams: null }).servingGrams,
    ).toBeNull();
  });

  it("should give a recipe with no servings no serving weight", () => {
    expect(
      palateRecipeOf({ id: "r", name: "Stew", servings: 0, yield_grams: 800 }).servingGrams,
    ).toBeNull();
  });
});
