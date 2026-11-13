import { describe, expect, it } from "vitest";

import { FIT_TOLERANCE, isWithinTolerance, outOfTolerance } from "../../../src/recipes";

import type { FitTolerance } from "../../../src/recipes";

const perServing = { kcal: 100, protein_g: 10, fat_g: 10, carbs_g: 10, fibre_g: 0 };

// Every field differs, so a field read for the wrong nutrient changes an answer.
const distinct: FitTolerance = { kcalPercent: 3, proteinGrams: 2, macroGrams: 7 };

describe("isWithinTolerance with distinct tolerance fields", () => {
  it("judges calories by kcalPercent of the target", () => {
    expect(isWithinTolerance(perServing, { kcal: 98 }, distinct)).toBe(true);
    expect(isWithinTolerance(perServing, { kcal: 96 }, distinct)).toBe(false);
  });

  it("judges protein by proteinGrams", () => {
    expect(isWithinTolerance(perServing, { protein_g: 12 }, distinct)).toBe(true);
    expect(isWithinTolerance(perServing, { protein_g: 12.5 }, distinct)).toBe(false);
  });

  it("judges carbs by macroGrams", () => {
    expect(isWithinTolerance(perServing, { carbs_g: 17 }, distinct)).toBe(true);
    expect(isWithinTolerance(perServing, { carbs_g: 17.5 }, distinct)).toBe(false);
  });

  it("judges fat by macroGrams", () => {
    expect(isWithinTolerance(perServing, { fat_g: 3 }, distinct)).toBe(true);
    expect(isWithinTolerance(perServing, { fat_g: 2.5 }, distinct)).toBe(false);
  });
});

describe("outOfTolerance", () => {
  it("uses FIT_TOLERANCE when no tolerance is given", () => {
    expect(FIT_TOLERANCE.proteinGrams).toBe(5);
    expect(isWithinTolerance(perServing, { protein_g: 15 })).toBe(true);
    expect(isWithinTolerance(perServing, { protein_g: 15.5 })).toBe(false);
  });

  it("does not judge a nutrient that is not named", () => {
    expect(outOfTolerance(perServing, {})).toEqual([]);
  });

  it("never reads a named nutrient with no data as a hit", () => {
    expect(outOfTolerance({ ...perServing, protein_g: null }, { protein_g: 0 })).toEqual([
      { nutrient: "protein_g", target: 0, achieved: null },
    ]);
  });
});
