import { describe, expect, it } from "vitest";

import { barNumbers, longestCapFraction } from "../../src/diary/barNumbers";

describe("barNumbers", () => {
  it("should fill the bar by the share eaten", () => {
    expect(barNumbers(86, 160)).toEqual({
      fillFraction: 86 / 160,
      capFraction: 0,
      isOver: false,
      overGrams: 0,
    });
  });

  it("should not be over at exactly the target", () => {
    expect(barNumbers(160, 160)).toEqual({
      fillFraction: 1,
      capFraction: 0,
      isOver: false,
      overGrams: 0,
    });
  });

  it("should complete the fill and add a cap for the share past the target", () => {
    const numbers = barNumbers(81, 70);

    expect(numbers.fillFraction).toBe(1);
    expect(numbers.capFraction).toBeCloseTo(11 / 70, 10);
    expect(numbers.isOver).toBe(true);
    expect(numbers.overGrams).toBe(11);
  });

  it("should stop the cap at 35 per cent of the bar however far over the day is", () => {
    expect(barNumbers(400, 100).capFraction).toBe(longestCapFraction);
    expect(longestCapFraction).toBe(0.35);
  });

  it("should leave the bar empty and never over when there is no target", () => {
    expect(barNumbers(86, 0)).toEqual({
      fillFraction: 0,
      capFraction: 0,
      isOver: false,
      overGrams: 0,
    });
  });
});
