import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatGrams,
  formatWeight,
  roundCalories,
  roundGrams,
  roundKilograms,
} from "../../src/format";

describe("roundCalories", () => {
  it.each([
    [2480.4, 2480],
    [2480.5, 2481],
    [0, 0],
  ])("should round %s to the whole number %s the Diary prints", (kcal, expected) => {
    expect(roundCalories(kcal)).toBe(expected);
  });

  it("should never give a negative zero", () => {
    expect(Object.is(roundCalories(-0.2), 0)).toBe(true);
  });
});

describe("roundGrams", () => {
  it.each([
    [125.6, 126],
    [9.96, 10],
    [9.94, 9.9],
    [0.04, 0],
    [4, 4],
  ])("should round %s grams to %s, one decimal only under 10", (grams, expected) => {
    expect(roundGrams(grams)).toBe(expected);
  });

  it("should never give a negative zero", () => {
    expect(Object.is(roundGrams(-0.04), 0)).toBe(true);
  });

  it("should be the number formatGrams prints", () => {
    fc.assert(
      fc.property(fc.double({ min: -500, max: 5000, noNaN: true }), (grams) => {
        expect(String(roundGrams(grams))).toBe(formatGrams(grams));
      }),
    );
  });
});

describe("roundKilograms", () => {
  it.each([
    [79.64, 79.6],
    [81.25, 81.3],
    [-0.4, -0.4],
  ])("should round %s kg to %s, one decimal", (kilograms, expected) => {
    expect(roundKilograms(kilograms)).toBe(expected);
  });

  it("should never give a negative zero", () => {
    expect(Object.is(roundKilograms(-0.02), 0)).toBe(true);
  });

  it("should be the number formatWeight prints", () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 400, noNaN: true }), (kilograms) => {
        expect(roundKilograms(kilograms).toFixed(1)).toBe(
          formatWeight(kilograms, "kg").slice(0, -3),
        );
      }),
    );
  });
});
