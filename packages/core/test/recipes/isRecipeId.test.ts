import { describe, expect, it } from "vitest";

import { isRecipeId } from "../../src/recipes";

describe("isRecipeId", () => {
  it("should accept the id of a recipe row", () => {
    expect(isRecipeId("55555555-5555-4555-8555-555555555555")).toBe(true);
  });

  it.each(["", "abc", "123", "55555555-5555-4555-8555-55555555555", "new"])(
    "should refuse %j, which cannot be a recipe id",
    (value) => {
      expect(isRecipeId(value)).toBe(false);
    },
  );
});
