import { describe, expect, it } from "vitest";

import { compactBelowSize, ringCircumference, ringNumbers } from "../../src/diary/ringMaths";

describe("ringNumbers", () => {
  it("should fill the ring by the share eaten and leave the rest as the calories remaining", () => {
    expect(ringNumbers(1039, 2200)).toEqual({
      eatenFraction: 1039 / 2200,
      overFraction: 0,
      remainingCalories: 1161,
      isOver: false,
    });
  });

  it("should be full and not over at exactly the target", () => {
    expect(ringNumbers(2200, 2200)).toEqual({
      eatenFraction: 1,
      overFraction: 0,
      remainingCalories: 0,
      isOver: false,
    });
  });

  it("should keep filling in the overflow past the target, and count the calories over", () => {
    const numbers = ringNumbers(2412, 2200);

    expect(numbers.eatenFraction).toBe(1);
    expect(numbers.overFraction).toBeCloseTo(212 / 2200, 10);
    expect(numbers.remainingCalories).toBe(212);
    expect(numbers.isOver).toBe(true);
  });

  it("should stop the overflow at one full lap and never reset", () => {
    expect(ringNumbers(9000, 2200).overFraction).toBe(1);
  });

  it("should work from whole calories, so half a calorie past the target is not over", () => {
    expect(ringNumbers(2200.4, 2200).isOver).toBe(false);
    expect(ringNumbers(2200.6, 2200).isOver).toBe(true);
  });

  it("should draw an empty ring when there is no target", () => {
    const numbers = ringNumbers(500, 0);

    expect(numbers.eatenFraction).toBe(0);
    expect(numbers.overFraction).toBe(0);
  });
});

describe("ringCircumference", () => {
  it("should be 584.3 for the 200 point ring with a 14 point stroke", () => {
    expect(ringCircumference(200, 14)).toBeCloseTo(584.3362, 4);
  });
});

describe("compactBelowSize", () => {
  it("should be 180, as the design system's card has it", () => {
    expect(compactBelowSize).toBe(180);
  });
});
