import { describe, expect, it } from "vitest";

import { MAX_FAVOURITE_FOODS } from "../../src/foods";

describe("MAX_FAVOURITE_FOODS", () => {
  it("should be 30, the number the food_favourites trigger enforces", () => {
    expect(MAX_FAVOURITE_FOODS).toBe(30);
  });
});
