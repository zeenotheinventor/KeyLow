import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatCalories,
  formatDeltaGrams,
  formatEnergyShare,
  formatGrams,
  formatWeight,
} from "../../src/format";

describe("formatCalories", () => {
  it.each([
    [2480, "2,480"],
    [2480.4, "2,480"],
    [2480.5, "2,481"],
    [148, "148"],
    [999, "999"],
    [1000, "1,000"],
    [1234567, "1,234,567"],
    [0, "0"],
  ])("should write %s as %s", (kcal, expected) => {
    expect(formatCalories(kcal)).toBe(expected);
  });

  it("should put a minus sign before a negative amount", () => {
    expect(formatCalories(-1234)).toBe("-1,234");
  });

  it("should never write a negative zero", () => {
    expect(formatCalories(-0.4)).toBe("0");
  });

  it("should never contain a decimal point", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e12, max: 1e12, noNaN: true }), (kcal) => {
        expect(formatCalories(kcal)).not.toContain(".");
      }),
    );
  });

  it("should round-trip through Number to the rounded input", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e12, max: 1e12, noNaN: true }), (kcal) => {
        const text = formatCalories(kcal);
        expect(Number(text.replaceAll(",", ""))).toBe(Math.round(kcal) + 0);
      }),
    );
  });

  it("should group the digits in threes from the right", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e12 }), (kcal) => {
        expect(formatCalories(kcal)).toMatch(/^\d{1,3}(,\d{3})*$/);
      }),
    );
  });
});

describe("formatGrams", () => {
  it.each([
    [7.5, "7.5"],
    [142, "142"],
    [142.4, "142"],
    [142.5, "143"],
    [0, "0"],
    [0.04, "0"],
    [2.2, "2.2"],
    [3.0, "3"],
    [9.94, "9.9"],
    [9.95, "10"],
    [10, "10"],
    [10.4, "10"],
    [13.5, "14"],
  ])("should write %s as %s", (grams, expected) => {
    expect(formatGrams(grams)).toBe(expected);
  });

  it("should apply the same rule to a negative amount by its absolute value", () => {
    expect(formatGrams(-7.5)).toBe("-7.5");
    expect(formatGrams(-142)).toBe("-142");
  });

  it("should never write a negative zero", () => {
    expect(formatGrams(-0.04)).toBe("0");
  });

  it("should never show a decimal at 10 or above", () => {
    fc.assert(
      fc.property(fc.double({ min: 10, max: 1e9, noNaN: true }), (grams) => {
        expect(formatGrams(grams)).not.toContain(".");
        expect(formatGrams(-grams)).not.toContain(".");
      }),
    );
  });

  it("should show at most one decimal below 10", () => {
    fc.assert(
      fc.property(fc.double({ min: -9.99, max: 9.99, noNaN: true }), (grams) => {
        expect(formatGrams(grams)).toMatch(/^-?\d+(\.\d)?$/);
      }),
    );
  });
});

describe("formatWeight", () => {
  it.each([
    [82.4, "kg", "82.4 kg"],
    [82.44, "kg", "82.4 kg"],
    [82.45, "kg", "82.5 kg"],
    [82, "kg", "82.0 kg"],
    [181.7, "lb", "181.7 lb"],
    [13, "st", "13.0 st"],
  ] as const)("should write %s %s as %s", (value, unit, expected) => {
    expect(formatWeight(value, unit)).toBe(expected);
  });

  it("should default to kilograms", () => {
    expect(formatWeight(82.4)).toBe("82.4 kg");
  });

  it("should always show exactly one decimal", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), (value) => {
        expect(formatWeight(value, "kg")).toMatch(/^\d+\.\d kg$/);
      }),
    );
  });
});

describe("formatDeltaGrams", () => {
  it("should write an amount over target with a plus sign", () => {
    expect(formatDeltaGrams(12.4)).toBe("+12 g");
    expect(formatDeltaGrams(7.5)).toBe("+7.5 g");
  });

  it("should write an amount under target with the true minus sign", () => {
    expect(formatDeltaGrams(-7.5)).toBe("−7.5 g");
    expect(formatDeltaGrams(-142)).toBe("−142 g");
  });

  it("should write no sign for zero", () => {
    expect(formatDeltaGrams(0)).toBe("0 g");
  });

  it("should never use a hyphen as the minus sign", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: -0.001, noNaN: true }), (grams) => {
        expect(formatDeltaGrams(grams).startsWith("−")).toBe(true);
      }),
    );
  });
});

describe("formatEnergyShare", () => {
  it.each([
    [32, "32 %"],
    [0, "0 %"],
    [100, "100 %"],
  ])("should write %s as %s", (percent, expected) => {
    expect(formatEnergyShare(percent)).toBe(expected);
  });
});
