import { describe, expect, it } from "vitest";

import { scaleOfBasis } from "../../src/nutrition/basisScale";
import { scaleNutrients } from "../../src/nutrition/scale";
import { resolveQuantity } from "../../src/nutrition/units";

import type { NullableNutrients } from "../../src/schemas/nutrients";

const bucket: NullableNutrients = {
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
  fibre_g: null,
};

const countPortion = { grams: null, ml: null };

describe("scaleOfBasis", () => {
  it("should be the amount over 100 for a per 100 g food", () => {
    expect(scaleOfBasis("per_100g", 250)).toBe(2.5);
  });

  it("should be the amount over 100 for a per 100 ml food", () => {
    expect(scaleOfBasis("per_100ml", 50)).toBe(0.5);
  });

  it("should be the count itself for a per portion food", () => {
    expect(scaleOfBasis("per_portion", 1.5)).toBe(1.5);
  });
});

describe("scaleNutrients with a basis", () => {
  it("should give 750 kcal for 1.5 portions of a 500 kcal per portion food", () => {
    expect(scaleNutrients(bucket, 1.5, "per_portion").kcal).toBe(750);
  });

  it("should keep an unknown value unknown for a per portion food", () => {
    expect(scaleNutrients(bucket, 2, "per_portion").fibre_g).toBeNull();
  });

  it("should divide by 100 for a per 100 g food", () => {
    expect(scaleNutrients(bucket, 150, "per_100g").kcal).toBe(750);
  });

  it("should refuse a negative count for a per portion food", () => {
    expect(() => scaleNutrients(bucket, -1, "per_portion")).toThrow(RangeError);
  });
});

describe("resolveQuantity for a per portion food", () => {
  const food = { basis: "per_portion", density_g_per_ml: null } as const;

  it("should give the count of portions as the amount", () => {
    expect(resolveQuantity(food, 1.5, "portion", countPortion)).toEqual({
      amount: 1.5,
      basis: "per_portion",
      densityAssumed: false,
    });
  });

  it.each(["g", "ml", "oz", "fl_oz"] as const)("should refuse %s", (unit) => {
    expect(() => resolveQuantity(food, 100, unit)).toThrow(RangeError);
  });

  it("should refuse a portion that has a weight", () => {
    expect(() => resolveQuantity(food, 1, "portion", { grams: 100, ml: null })).toThrow(RangeError);
  });

  it("should refuse the portion unit without a portion", () => {
    expect(() => resolveQuantity(food, 1, "portion")).toThrow(RangeError);
  });

  it("should refuse a negative count", () => {
    expect(() => resolveQuantity(food, -1, "portion", countPortion)).toThrow(RangeError);
  });
});

describe("resolveQuantity for a food measured by weight or volume", () => {
  it("should still refuse a count portion, which has no size to resolve", () => {
    expect(() =>
      resolveQuantity({ basis: "per_100g", density_g_per_ml: null }, 1, "portion", countPortion),
    ).toThrow(RangeError);
  });
});
