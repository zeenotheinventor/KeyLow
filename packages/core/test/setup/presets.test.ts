import { describe, expect, it } from "vitest";

import {
  DEFAULT_DIET_STYLE,
  DEFAULT_PROTEIN_PRESET,
  DEFAULT_RATE_PCT_PER_WEEK,
  DIET_FAT_FRACTION_OF_REMAINDER,
  PROTEIN_G_PER_KG,
  RATE_PRESETS_PCT_PER_WEEK,
  ratePerWeekKg,
} from "../../src/setup";

describe("the setup presets", () => {
  describe("rates", () => {
    it("should offer 0.25, 0.5, 0.75 and 1.0 percent a week to lose", () => {
      expect(RATE_PRESETS_PCT_PER_WEEK.lose).toEqual([0.25, 0.5, 0.75, 1.0]);
    });

    it("should offer 0.1, 0.25 and 0.5 percent a week to gain", () => {
      expect(RATE_PRESETS_PCT_PER_WEEK.gain).toEqual([0.1, 0.25, 0.5]);
    });

    it("should offer only zero to maintain", () => {
      expect(RATE_PRESETS_PCT_PER_WEEK.maintain).toEqual([0]);
    });

    it("should default to 0.5 to lose, 0.25 to gain and 0 to maintain", () => {
      expect(DEFAULT_RATE_PCT_PER_WEEK).toEqual({ lose: 0.5, maintain: 0, gain: 0.25 });
    });
  });

  describe("protein", () => {
    it("should be 1.6, 2.0 and 2.2 grams per kilogram", () => {
      expect(PROTEIN_G_PER_KG).toEqual({ moderate: 1.6, high: 2.0, very_high: 2.2 });
    });

    it("should default to moderate", () => {
      expect(DEFAULT_PROTEIN_PRESET).toBe("moderate");
    });
  });

  describe("diet style", () => {
    it("should be the keys of the engine's fat fractions with their values", () => {
      expect(DIET_FAT_FRACTION_OF_REMAINDER).toEqual({
        balanced: 0.4,
        low_fat: 0.28,
        low_carb: 0.6,
      });
    });

    it("should default to balanced", () => {
      expect(DEFAULT_DIET_STYLE).toBe("balanced");
    });
  });
});

describe("ratePerWeekKg", () => {
  it.each([
    [0.5, 80, 0.4],
    [1.0, 70, 0.7],
    [0.25, 100, 0.25],
    [0, 80, 0],
  ])("should turn %s percent of %s kg into %s kg a week", (ratePct, weightKg, expected) => {
    expect(ratePerWeekKg(ratePct, weightKg)).toBe(expected);
  });
});
