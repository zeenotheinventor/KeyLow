import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { energyShares } from "../../src/search";

describe("energyShares", () => {
  it("should give the Atwater share of the stated energy for protein, carbohydrate and fat", () => {
    expect(energyShares({ kcal: 148, protein_g: 32, carbs_g: 0, fat_g: 2.2 })).toEqual({
      protein: 86,
      carbs: 0,
      fat: 13,
    });
  });

  it("should round each share to a whole per cent", () => {
    expect(energyShares({ kcal: 381, protein_g: 11, carbs_g: 71, fat_g: 8.1 })).toEqual({
      protein: 12,
      carbs: 75,
      fat: 19,
    });
  });

  it("should round a half up", () => {
    expect(energyShares({ kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5 }).fat).toBe(23);
  });

  it("should not force the shares to sum to 100, because fibre and alcohol are not counted", () => {
    const shares = energyShares({ kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5 });

    expect(shares).toEqual({ protein: 20, carbs: 40, fat: 23 });
    expect((shares.protein ?? 0) + (shares.carbs ?? 0) + (shares.fat ?? 0)).toBe(83);
  });

  it("should give null for a share whose macro is missing, never 0", () => {
    expect(energyShares({ kcal: 200, protein_g: null, carbs_g: 20, fat_g: 10 })).toEqual({
      protein: null,
      carbs: 40,
      fat: 45,
    });
  });

  it("should give null for every share when the energy is missing", () => {
    expect(energyShares({ kcal: null, protein_g: 8, carbs_g: 20, fat_g: 10 })).toEqual({
      protein: null,
      carbs: null,
      fat: null,
    });
  });

  it("should give null for every share when the energy is zero, because a share of nothing is undefined", () => {
    expect(energyShares({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })).toEqual({
      protein: null,
      carbs: null,
      fat: null,
    });
  });

  it("should keep a stated zero macro as a zero share", () => {
    expect(energyShares({ kcal: 100, protein_g: 0, carbs_g: 0, fat_g: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("should always give whole numbers or null", () => {
    const amount = fc.option(fc.double({ min: 0, max: 1000, noNaN: true }), { nil: null });
    fc.assert(
      fc.property(amount, amount, amount, amount, (kcal, protein_g, carbs_g, fat_g) => {
        const shares = energyShares({ kcal, protein_g, carbs_g, fat_g });

        for (const share of [shares.protein, shares.carbs, shares.fat]) {
          expect(share === null || Number.isInteger(share)).toBe(true);
        }
      }),
    );
  });
});
