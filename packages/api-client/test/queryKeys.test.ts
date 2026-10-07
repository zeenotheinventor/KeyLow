import { describe, expect, it } from "vitest";

import { keys } from "../src/queryKeys";

describe("keys.profiles", () => {
  it("should expose the profiles root key", () => {
    expect(keys.profiles.all).toEqual(["profiles"]);
  });

  it("should build a detail key scoped to the profile id", () => {
    expect(keys.profiles.detail("user-1")).toEqual(["profiles", "user-1"]);
  });
});

describe("keys.foods", () => {
  it("should expose the foods root key", () => {
    expect(keys.foods.all).toEqual(["foods"]);
  });

  it("should build a detail key scoped to the food id", () => {
    expect(keys.foods.detail("food-1")).toEqual(["foods", "food-1"]);
  });

  it("should build a portions key nested under the food detail key", () => {
    expect(keys.foods.portions("food-1")).toEqual(["foods", "food-1", "portions"]);
  });

  it("should build a search key scoped to the query text", () => {
    expect(keys.foods.search("chicken")).toEqual(["foods", "search", "chicken"]);
  });

  it("should build an Open Food Facts search key scoped to the query text", () => {
    expect(keys.foods.offSearch("chicken")).toEqual(["foods", "off-search", "chicken"]);
  });

  it("should build a barcode key scoped to the code", () => {
    expect(keys.foods.barcode("0036000291452")).toEqual(["foods", "barcode", "0036000291452"]);
  });

  it("should nest every foods key under the foods root so one invalidation covers them all", () => {
    const rootLength = keys.foods.all.length;

    for (const key of [
      keys.foods.detail("food-1"),
      keys.foods.portions("food-1"),
      keys.foods.search("chicken"),
      keys.foods.offSearch("chicken"),
      keys.foods.barcode("0036000291452"),
    ]) {
      expect(key.slice(0, rootLength)).toEqual(keys.foods.all);
    }
  });
});
