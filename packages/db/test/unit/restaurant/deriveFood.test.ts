import { describe, expect, it } from "vitest";

import { deriveFood } from "../../../scripts/restaurant/deriveFood";
import { parseRestaurantCsv } from "../../../scripts/restaurant/restaurantFoodsCsv";
import {
  testBurger,
  restaurantCsvOf,
  testBucket,
  testNandosDish,
} from "../../support/restaurantCsv";

const rowOf = (cells: typeof testBurger) => {
  const [row] = parseRestaurantCsv(restaurantCsvOf(cells));
  if (row === undefined) {
    throw new Error("The fixture has no row");
  }
  return row;
};

describe("deriveFood", () => {
  describe("a food whose chain publishes a weight", () => {
    const food = deriveFood(rowOf(testBurger));

    it("should be per 100 g", () => {
      expect(food.basis).toBe("per_100g");
    });

    it("should scale each figure by 100 over the grams, to two decimals", () => {
      expect(food.nutrients).toEqual({
        kcal: 232.56,
        protein_g: 12.09,
        fat_g: 11.63,
        sat_fat_g: 4.65,
        carbs_g: 20.93,
        sugars_g: 4.19,
        fibre_g: 1.63,
        salt_g: 0.98,
      });
    });

    it("should have one default portion that weighs the published grams", () => {
      expect(food.portion).toEqual({ label: "1 burger", grams: 215 });
    });
  });

  it("should leave a figure the chain does not publish as null, never 0", () => {
    const food = deriveFood(rowOf({ ...testBurger, fibre_g: "", salt_g: "" }));

    expect(food.nutrients.fibre_g).toBeNull();
    expect(food.nutrients.salt_g).toBeNull();
    expect(food.nutrients.kcal).toBe(232.56);
  });

  describe("a food whose chain publishes no weight", () => {
    const food = deriveFood(rowOf(testBucket));

    it("should be per portion", () => {
      expect(food.basis).toBe("per_portion");
    });

    it("should keep the figures exactly as the chain publishes them", () => {
      expect(food.nutrients.kcal).toBe(500);
      expect(food.nutrients.fibre_g).toBe(3.5);
    });

    it("should have a count portion with no grams", () => {
      expect(food.portion).toEqual({ label: "1 bucket", grams: null });
    });
  });

  it("should refuse a weight basis that disagrees with the grams", () => {
    expect(() => deriveFood(rowOf({ ...testBurger, weight_basis: "none" }))).toThrow(
      "testchain-gb:test-burger: the weight basis none does not match the grams 215",
    );
    expect(() => deriveFood(rowOf({ ...testBucket, weight_basis: "published" }))).toThrow(
      "otherchain-gb:test-bucket: the weight basis published does not match the grams none",
    );
  });

  describe("quality", () => {
    it("should mark a Nando's food as having estimated macros", () => {
      expect(deriveFood(rowOf(testNandosDish)).quality).toEqual({ macros_estimated: true });
    });

    it("should leave the quality of a food whose chain publishes every figure empty", () => {
      expect(deriveFood(rowOf(testBurger)).quality).toEqual({});
      expect(deriveFood(rowOf(testBucket)).quality).toEqual({});
    });
  });
});
