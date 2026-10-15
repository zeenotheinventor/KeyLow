import { describe, expect, it } from "vitest";

import {
  MACRO_MISMATCH_SHARE_OF_CALORIES,
  macrosDisagreeWithCalories,
} from "../../../src/diary/rules/macrosDisagreeWithCalories";

describe("the mismatch threshold", () => {
  it("should pin the share of calories to 0.25", () => {
    expect(MACRO_MISMATCH_SHARE_OF_CALORIES).toBe(0.25);
  });
});

describe("macrosDisagreeWithCalories", () => {
  it("should agree when the macros add up to the calories", () => {
    expect(macrosDisagreeWithCalories(131, 2, 7, 15)).toBe(false);
  });

  it("should disagree when the macros add up to far more", () => {
    expect(macrosDisagreeWithCalories(130, 20, 10, 15)).toBe(true);
  });

  it("should agree at exactly 25 % above the calories", () => {
    // 31.25 g of protein is 125 kcal against 100 kcal.
    expect(macrosDisagreeWithCalories(100, 31.25, null, null)).toBe(false);
  });

  it("should disagree just over 25 % above the calories", () => {
    expect(macrosDisagreeWithCalories(100, 31.5, null, null)).toBe(true);
  });

  it("should agree at exactly 25 % below the calories", () => {
    expect(macrosDisagreeWithCalories(100, 18.75, null, null)).toBe(false);
  });

  it("should disagree just over 25 % below the calories", () => {
    expect(macrosDisagreeWithCalories(100, 18.5, null, null)).toBe(true);
  });

  it("should not disagree when no macro is given", () => {
    expect(macrosDisagreeWithCalories(130, null, null, null)).toBe(false);
  });

  it("should count a macro of 0 as given", () => {
    expect(macrosDisagreeWithCalories(130, 0, null, null)).toBe(true);
  });

  it("should not disagree when the calories are not above 0", () => {
    expect(macrosDisagreeWithCalories(0, 20, 10, 15)).toBe(false);
    expect(macrosDisagreeWithCalories(null, 20, 10, 15)).toBe(false);
    expect(macrosDisagreeWithCalories(Number.NaN, 20, 10, 15)).toBe(false);
  });
});
