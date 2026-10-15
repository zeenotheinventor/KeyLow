import { describe, expect, it } from "vitest";

import { barNumbers } from "../../src/diary/barNumbers";

describe("barNumbers", () => {
  it("should fill the bar by the share eaten", () => {
    expect(barNumbers(86, 160)).toEqual({
      fillFraction: 86 / 160,
      isOver: false,
      overGrams: 0,
    });
  });

  it("should not be over at exactly the target", () => {
    expect(barNumbers(160, 160)).toEqual({
      fillFraction: 1,
      isOver: false,
      overGrams: 0,
    });
  });

  it("should complete the fill past the target and count the grams over", () => {
    expect(barNumbers(81, 70)).toEqual({ fillFraction: 1, isOver: true, overGrams: 11 });
  });

  it("should leave the bar empty and never over when there is no target", () => {
    expect(barNumbers(86, 0)).toEqual({
      fillFraction: 0,
      isOver: false,
      overGrams: 0,
    });
  });
});
