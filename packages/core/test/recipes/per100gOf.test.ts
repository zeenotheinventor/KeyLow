import { describe, expect, it } from "vitest";

import { per100gOf } from "../../src/recipes";

const total = { kcal: 1496.8, protein_g: 126.5, fat_g: null, carbs_g: 80, fibre_g: 0 };

const nothingKnown = { kcal: null, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null };

describe("per100gOf", () => {
  it("should divide each known value by the grams and multiply by 100", () => {
    const per100g = per100gOf(total, 1100);

    expect(per100g.kcal).toBe((1496.8 / 1100) * 100);
    expect(per100g.protein_g).toBe((126.5 / 1100) * 100);
    expect(per100g.carbs_g).toBe((80 / 1100) * 100);
    expect(per100g.fibre_g).toBe(0);
  });

  it("should leave an unknown value unknown", () => {
    expect(per100gOf(total, 1100).fat_g).toBeNull();
  });

  it("should keep an optional key only when the total has it", () => {
    expect(per100gOf(total, 1100)).not.toHaveProperty("sat_fat_g");
    expect(per100gOf({ ...total, sat_fat_g: 55 }, 1100).sat_fat_g).toBe((55 / 1100) * 100);
  });

  it.each([0, -1, Number.NaN])("should know nothing for a weight of %s", (grams) => {
    expect(per100gOf(total, grams)).toEqual(nothingKnown);
  });
});
