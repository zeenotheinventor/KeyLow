import { describe, expect, it } from "vitest";

import { applyProfileCap, deriveTargets } from "../../src/engine";

import type { DeriveTargetsInput } from "../../src/engine";

/*
 * Every expected figure is a literal, worked out by hand from ADR 0002, Amendment 1 and 2 (the 6000 cap
 * and the macro split) and not read from the module under test.
 */

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

function capped(input: DeriveTargetsInput) {
  return applyProfileCap(deriveTargets(input), input);
}

describe("applyProfileCap under the cap", () => {
  const input: DeriveTargetsInput = {
    config: { goal: "lose", ratePctPerWeek: 0.5, proteinGPerKg: 1.6, fatFraction: 0.4 },
    tdee: 2579.54,
    trendWeight: 78.65,
    bmr: 1755,
  };

  it("should return the derived calories and macros unchanged", () => {
    const result = capped(input);

    expect([result.caloriesKcal, result.proteinG, result.fatG, result.carbsG]).toStrictEqual([
      2150, 126, 73, 247,
    ]);
  });

  it("should return the derived clamps and effective rate unchanged", () => {
    const result = capped({
      config: { ...input.config, ratePctPerWeek: 1 },
      tdee: 1700,
      trendWeight: 55,
      bmr: 1250,
    });

    expect(result.caloriesKcal).toBe(1200);
    expect(result.clamps).toStrictEqual(["max_deficit", "floor"]);
    expectWithin(result.effectiveRatePctPerWeek, 0.826, 1e-3);
  });

  it("should keep a macro_fit that the derived targets recorded when nothing is capped", () => {
    // Protein 3.0 g/kg of 370 kg is 1110 g and the fat floor is 185 g: 6105 kcal, over 5000.
    const result = capped({
      config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 3, fatFraction: 0.4 },
      tdee: 5000,
      trendWeight: 370,
      bmr: 1755,
    });

    expect(result.caloriesKcal).toBe(5000);
    expect(result.clamps).toStrictEqual(["macro_fit"]);
  });
});

describe("applyProfileCap over the cap", () => {
  const gainInput: DeriveTargetsInput = {
    config: { goal: "gain", ratePctPerWeek: 0.5, proteinGPerKg: 1.6, fatFraction: 0.4 },
    tdee: 5500,
    trendWeight: 100,
    bmr: 1755,
  };

  it("should cut a raw 6050 to 6000 and record profile_max", () => {
    const result = capped(gainInput);

    expect(result.caloriesKcal).toBe(6000);
    expect(result.clamps).toStrictEqual(["profile_max"]);
  });

  it("should split the macros again for the capped calories", () => {
    // 6050 kcal gives P 160, F 240, C 813. 6000 kcal gives P 160, F 238, C 805.
    const result = capped(gainInput);

    expect([result.proteinG, result.fatG, result.carbsG]).toStrictEqual([160, 238, 805]);
  });

  it("should restate the effective rate for the capped calories", () => {
    // (6000 - 5500) kcal against 1100 kcal a day for each percent a week at 100 kg.
    expectWithin(capped(gainInput).effectiveRatePctPerWeek, 0.4545, 1e-4);
  });

  it("should list the calorie clamps, then profile_max, then the new macro clamps", () => {
    // 370 kg, maintain at 6050: 6050 kcal is cut to 6000, which is under protein 1110 g and fat 185 g.
    const result = capped({
      config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 3, fatFraction: 0.4 },
      tdee: 6050,
      trendWeight: 370,
      bmr: 1755,
    });

    expect(result.caloriesKcal).toBe(6000);
    expect(result.clamps).toStrictEqual(["profile_max", "macro_fit"]);
  });

  it("should put an engine calorie clamp before profile_max and macro_fit last", () => {
    // 400 kg gaining 0.5 % a week from 5500: raw 7700 is held to the surplus bound 6600, then cut to 6000.
    const result = capped({
      config: { goal: "gain", ratePctPerWeek: 0.5, proteinGPerKg: 3, fatFraction: 0.4 },
      tdee: 5500,
      trendWeight: 400,
      bmr: 1755,
    });

    expect(result.clamps).toStrictEqual(["max_surplus", "profile_max", "macro_fit"]);
    expect([result.proteinG, result.fatG, result.carbsG]).toStrictEqual([1050, 200, 0]);
  });

  it("should record macro_fit once, not once from before the cap and once from after it", () => {
    const result = capped({
      config: { goal: "maintain", ratePctPerWeek: 0, proteinGPerKg: 3, fatFraction: 0.4 },
      tdee: 6050,
      trendWeight: 370,
      bmr: 1755,
    });

    expect(result.clamps.filter((clamp) => clamp === "macro_fit")).toHaveLength(1);
  });
});
