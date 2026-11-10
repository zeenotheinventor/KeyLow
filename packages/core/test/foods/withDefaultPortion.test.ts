import { describe, expect, it } from "vitest";

import { estimatedPortion } from "../../src/foods/estimatedPortion";
import { withDefaultPortion } from "../../src/foods/withDefaultPortion";

const solidFood = { basis: "per_100g", kcal: 400 } as const;
const drinkFood = { basis: "per_100ml", kcal: 40 } as const;

describe("withDefaultPortion", () => {
  it("should never give a food per portion an estimate, which it has no weight to size", () => {
    expect(() => withDefaultPortion({ basis: "per_portion", kcal: 1250 }, [])).toThrow(RangeError);
  });

  it("should give a food with no portions one typical serving from its energy", () => {
    const estimate = estimatedPortion({ basis: "per_100g", kcal: 400 });

    expect(withDefaultPortion(solidFood, [])).toEqual([
      { label: estimate.label, grams: estimate.grams, isDefault: true },
    ]);
  });

  it("should size the estimate in millilitres for a food per 100 ml", () => {
    const estimate = estimatedPortion({ basis: "per_100ml", kcal: 40 });

    expect(withDefaultPortion(drinkFood, [])).toEqual([
      { label: estimate.label, ml: estimate.ml, isDefault: true },
    ]);
  });

  it("should open on 1 typical serving of 100 g when the energy is not known", () => {
    expect(withDefaultPortion({ basis: "per_100g", kcal: null }, [])).toEqual([
      { label: "1 typical serving", grams: 100, isDefault: true },
    ]);
  });

  it("should make the first portion the default when none is", () => {
    const portions = [
      { label: "1 bar", grams: 45, isDefault: false },
      { label: "1 pack", grams: 90, isDefault: false },
    ];

    expect(withDefaultPortion(solidFood, portions)).toEqual([
      { label: "1 bar", grams: 45, isDefault: true },
      { label: "1 pack", grams: 90, isDefault: false },
    ]);
  });

  it("should keep the default the person chose", () => {
    const portions = [
      { label: "1 bar", grams: 45, isDefault: false },
      { label: "1 pack", grams: 90, isDefault: true },
    ];

    expect(withDefaultPortion(solidFood, portions)).toEqual(portions);
  });

  it("should not change the portions it was given", () => {
    const portions = [{ label: "1 bar", grams: 45, isDefault: false }];

    withDefaultPortion(solidFood, portions);

    expect(portions).toEqual([{ label: "1 bar", grams: 45, isDefault: false }]);
  });
});
