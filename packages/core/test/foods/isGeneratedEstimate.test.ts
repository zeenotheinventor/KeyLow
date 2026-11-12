import { describe, expect, it } from "vitest";

import { estimatedPortion, isGeneratedEstimate } from "../../src/foods/estimatedPortion";
import { buildFood, buildFoodPortion } from "../../src/testing";

const food = buildFood({ basis: "per_100g", kcal: 400, food_group: null });
const generated = estimatedPortion({ basis: "per_100g", kcal: 400 });

const storedEstimate = (overrides = {}) =>
  buildFoodPortion({
    label: generated.label,
    grams: generated.grams,
    ml: generated.ml,
    is_default: true,
    ...overrides,
  });

describe("isGeneratedEstimate", () => {
  it("should never take the count portion of a food per portion for an estimate", () => {
    const bucket = buildFood({ source: "restaurant", basis: "per_portion", kcal: 1250 });
    const countPortion = buildFoodPortion({
      label: "1 typical serving",
      grams: null,
      ml: null,
      is_default: true,
    });

    expect(isGeneratedEstimate(bucket, [countPortion])).toBe(false);
  });

  it("should recognise the one portion withDefaultPortion would generate for the food", () => {
    expect(isGeneratedEstimate(food, [storedEstimate()])).toBe(true);
  });

  it("should recognise it in millilitres for a food per 100 ml", () => {
    const drink = buildFood({ basis: "per_100ml", kcal: 40, food_group: null });
    const estimate = estimatedPortion({ basis: "per_100ml", kcal: 40 });

    expect(
      isGeneratedEstimate(drink, [
        buildFoodPortion({ label: estimate.label, grams: null, ml: estimate.ml, is_default: true }),
      ]),
    ).toBe(true);
  });

  it("should recognise the row the migration gives a CoFID food from its food group", () => {
    const burger = buildFood({ source: "cofid", food_group: "MBG", kcal: 232 });
    const estimate = estimatedPortion({ basis: "per_100g", kcal: 232, foodGroup: "MBG" });

    expect(
      isGeneratedEstimate(burger, [
        buildFoodPortion({ label: estimate.label, grams: estimate.grams, is_default: true }),
      ]),
    ).toBe(true);
  });

  it("should not take a portion the person typed that happens to start with 1 typical", () => {
    const typed = buildFoodPortion({ label: "1 typical slice", grams: 35, is_default: true });

    expect(isGeneratedEstimate(food, [typed])).toBe(false);
  });

  it("should not take a portion with the estimate's label but another size", () => {
    expect(isGeneratedEstimate(food, [storedEstimate({ grams: 55 })])).toBe(false);
  });

  it("should not take the estimate when the person has other portions beside it", () => {
    const own = buildFoodPortion({ label: "1 bar", grams: 45, is_default: false });

    expect(isGeneratedEstimate(food, [storedEstimate(), own])).toBe(false);
  });

  it("should not take an estimate that is not the default", () => {
    expect(isGeneratedEstimate(food, [storedEstimate({ is_default: false })])).toBe(false);
  });

  it("should not take any portion of a food that has none", () => {
    expect(isGeneratedEstimate(food, [])).toBe(false);
  });

  it("should not take the estimate of another energy, because the food's energy has changed", () => {
    expect(isGeneratedEstimate(buildFood({ kcal: 40, food_group: null }), [storedEstimate()])).toBe(
      false,
    );
  });
});
