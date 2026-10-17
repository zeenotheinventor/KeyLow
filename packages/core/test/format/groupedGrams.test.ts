import { describe, expect, it } from "vitest";

import { formatGrams, formatGroupedGrams } from "../../src/format";

describe("formatGroupedGrams", () => {
  it.each([
    [0, "0"],
    [7.5, "7.5"],
    [9.95, "10"],
    [155, "155"],
    [275, "275"],
    [412.5, "413"],
    [999, "999"],
    [999.4, "999"],
    [999.5, "1,000"],
    [1100, "1,100"],
    [1650, "1,650"],
    [50000, "50,000"],
    [1234567, "1,234,567"],
  ])("should write %s grams as %s", (grams, expected) => {
    expect(formatGroupedGrams(grams)).toBe(expected);
  });

  it("should put the separator before the digits of a negative amount, not after the minus sign", () => {
    expect(formatGroupedGrams(-1234.4)).toBe("-1,234");
  });

  it("should write exactly what formatGrams writes below 1,000, so the two never disagree", () => {
    for (const grams of [0, 0.04, 2.2, 9.04, 10, 10.5, 142, 999.4]) {
      expect(formatGroupedGrams(grams)).toBe(formatGrams(grams));
    }
  });
});
