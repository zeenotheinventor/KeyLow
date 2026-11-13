import { describe, expect, it } from "vitest";

import { adjustmentTarget } from "../../../src/recipes";

const perServing = { kcal: 518, protein_g: 49.3, fat_g: 20, carbs_g: 60, fibre_g: 5 };

describe("adjustmentTarget", () => {
  it("adds 30 g of protein and holds the calories at the original", () => {
    expect(adjustmentTarget(perServing, { nutrient: "protein_g", mode: "add", value: 30 })).toEqual(
      {
        kcal: 518,
        protein_g: 79.3,
      },
    );
  });

  it("reads a third fewer carbs as a multiply and holds the calories", () => {
    const target = adjustmentTarget(perServing, {
      nutrient: "carbs_g",
      mode: "multiply",
      value: 0.667,
    });
    expect(target.carbs_g).toBeCloseTo(40.02);
    expect(target.kcal).toBe(518);
  });

  it("does not hold the calories when the change names them", () => {
    expect(adjustmentTarget(perServing, { nutrient: "kcal", mode: "set", value: 600 })).toEqual({
      kcal: 600,
    });
  });

  it("never gives a target below 0", () => {
    expect(adjustmentTarget(perServing, { nutrient: "fat_g", mode: "add", value: -50 })).toEqual({
      kcal: 518,
      fat_g: 0,
    });
  });

  it("refuses a nutrient the recipe has no figure for", () => {
    expect(() =>
      adjustmentTarget(
        { ...perServing, carbs_g: null },
        { nutrient: "carbs_g", mode: "add", value: 5 },
      ),
    ).toThrow(RangeError);
  });

  it("refuses a value that is not finite or a multiplier below 0", () => {
    expect(() =>
      adjustmentTarget(perServing, { nutrient: "protein_g", mode: "add", value: Number.NaN }),
    ).toThrow(RangeError);
    expect(() =>
      adjustmentTarget(perServing, { nutrient: "protein_g", mode: "multiply", value: -1 }),
    ).toThrow(RangeError);
  });
});
