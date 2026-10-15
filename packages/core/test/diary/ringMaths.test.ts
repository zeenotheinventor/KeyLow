import { describe, expect, it } from "vitest";

import { compactBelowSize, ringCircumference, ringNumbers } from "../../src/diary/ringMaths";

describe("ringNumbers", () => {
  it("should fill the ring by the share eaten and leave the rest as the calories remaining", () => {
    expect(ringNumbers(1039, 2200)).toEqual({
      eatenFraction: 1039 / 2200,
      remainingCalories: 1161,
      isOver: false,
      hasTarget: true,
    });
  });

  it("should be full and not over at exactly the target", () => {
    expect(ringNumbers(2200, 2200)).toEqual({
      eatenFraction: 1,
      remainingCalories: 0,
      isOver: false,
      hasTarget: true,
    });
  });

  it("should be full past the target, and count the calories over", () => {
    expect(ringNumbers(2412, 2200)).toEqual({
      eatenFraction: 1,
      remainingCalories: 212,
      isOver: true,
      hasTarget: true,
    });
  });

  it("should stay one full lap however far past the target the day is", () => {
    expect(ringNumbers(9000, 2200).eatenFraction).toBe(1);
  });

  it("should work from whole calories, so half a calorie past the target is not over", () => {
    expect(ringNumbers(2200.4, 2200).isOver).toBe(false);
    expect(ringNumbers(2200.6, 2200).isOver).toBe(true);
  });

  it("should draw an empty ring when there is no target", () => {
    expect(ringNumbers(500, 0).eatenFraction).toBe(0);
  });

  it("should say there is no target at zero, and count the calories eaten as the number to print", () => {
    const numbers = ringNumbers(1039, 0);

    expect(numbers.hasTarget).toBe(false);
    expect(numbers.remainingCalories).toBe(1039);
  });

  it("should never be over when there is no target", () => {
    expect(ringNumbers(500, 0).isOver).toBe(false);
  });

  it("should have a target from one calorie up", () => {
    expect(ringNumbers(0, 1).hasTarget).toBe(true);
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
