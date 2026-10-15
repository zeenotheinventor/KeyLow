import { describe, expect, it } from "vitest";

import { macroKcal } from "../../../src/diary/rules/macroKcal";

describe("macroKcal", () => {
  it("should count 4 kcal per gram of protein", () => {
    expect(macroKcal(10, 0, 0)).toBe(40);
  });

  it("should count 9 kcal per gram of fat", () => {
    expect(macroKcal(0, 10, 0)).toBe(90);
  });

  it("should count 4 kcal per gram of carbohydrate", () => {
    expect(macroKcal(0, 0, 10)).toBe(40);
  });

  it("should add the three", () => {
    expect(macroKcal(2, 7, 15)).toBe(131);
  });

  it("should treat a null as 0", () => {
    expect(macroKcal(null, 7, null)).toBe(63);
    expect(macroKcal(null, null, null)).toBe(0);
  });

  it("should keep the decimals", () => {
    expect(macroKcal(1.5, 0.5, 2.25)).toBe(19.5);
  });
});
