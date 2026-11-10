import { describe, expect, it } from "vitest";

import { canBeRecipeIngredient } from "../../src/recipes";

describe("canBeRecipeIngredient", () => {
  it.each(["per_100g", "per_100ml"] as const)("should accept a food %s", (basis) => {
    expect(canBeRecipeIngredient({ basis })).toBe(true);
  });

  it("should refuse a food per portion, because a recipe's weight is a sum of grams", () => {
    expect(canBeRecipeIngredient({ basis: "per_portion" })).toBe(false);
  });
});
