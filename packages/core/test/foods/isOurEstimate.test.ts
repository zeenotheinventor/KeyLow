import { describe, expect, it } from "vitest";

import { estimatedPortion, isOurEstimate } from "../../src/foods/estimatedPortion";
import { buildFood, buildFoodPortion } from "../../src/testing";

const food = buildFood({ basis: "per_100g", kcal: 400, food_group: null });
const generated = estimatedPortion({ basis: "per_100g", kcal: 400 });
const person = "00000000-0000-4000-8000-0000000000a1";

const estimate = (overrides = {}) =>
  buildFoodPortion({
    label: generated.label,
    grams: generated.grams,
    is_default: true,
    owner_id: null,
    ...overrides,
  });

describe("isOurEstimate", () => {
  it("should take a shared estimate that sits beside a pack chip", () => {
    const chip = buildFoodPortion({
      label: "1 bag",
      grams: 2000,
      is_default: false,
      owner_id: null,
    });
    const portion = estimate({ label: "1 typical serving", grams: 75 });

    expect(isOurEstimate(food, portion, [portion, chip])).toBe(true);
  });

  it("should take a shared category estimate the energy rules would not give", () => {
    const burger = estimate({ label: "1 typical burger", grams: 200 });

    expect(isOurEstimate(food, burger, [burger])).toBe(true);
  });

  it("should not take a shared portion that is measured", () => {
    const measured = buildFoodPortion({ label: "1 slice", grams: 30, owner_id: null });

    expect(isOurEstimate(food, measured, [measured])).toBe(false);
  });

  it("should not take a portion the person typed, even when it starts 1 typical", () => {
    const typed = estimate({ label: "1 typical slice", grams: 35, owner_id: person });

    expect(isOurEstimate(food, typed, [typed])).toBe(false);
  });

  it("should take the person's own portion when it is the one the app generated", () => {
    const own = estimate({ owner_id: person });

    expect(isOurEstimate(food, own, [own])).toBe(true);
  });
});
