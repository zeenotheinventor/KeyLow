import { describe, expect, it } from "vitest";

import { MAX_FAVOURITES } from "../../src/foods";

describe("MAX_FAVOURITES", () => {
  it("should be 30, the number the food_favourites and recipe_favourites triggers enforce", () => {
    expect(MAX_FAVOURITES).toBe(30);
  });
});
