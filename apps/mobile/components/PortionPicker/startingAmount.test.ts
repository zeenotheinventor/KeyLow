import { buildFood, buildFoodPortion } from "@keylow/core/testing";

import { startingAmount, unitOptions, unitValueOf } from "./startingAmount";

const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });
const large = buildFoodPortion({
  id: "portion-large",
  label: "1 large",
  grams: 150,
  is_default: true,
});
const glass = buildFoodPortion({ id: "portion-glass", label: "1 glass", grams: null, ml: 200 });

describe("unitOptions", () => {
  it("should list the food's portions, then g", () => {
    expect(unitOptions(buildFood(), [medium, large])).toEqual([
      { value: "portion-medium", label: "1 medium" },
      { value: "portion-large", label: "1 large" },
      { value: "g", label: "g" },
    ]);
  });

  it("should offer g alone for a food with no portions", () => {
    expect(unitOptions(buildFood(), [])).toEqual([{ value: "g", label: "g" }]);
  });

  it("should add ml for a food measured per 100 ml", () => {
    expect(unitOptions(buildFood({ basis: "per_100ml" }), [glass])).toEqual([
      { value: "portion-glass", label: "1 glass" },
      { value: "g", label: "g" },
      { value: "ml", label: "ml" },
    ]);
  });

  it("should add ml for a food that has a density, because millilitres then mean something", () => {
    expect(
      unitOptions(buildFood({ density_g_per_ml: 0.92 }), []).map((option) => option.value),
    ).toEqual(["g", "ml"]);
  });
});

describe("startingAmount", () => {
  it("should start at one of the default portion", () => {
    expect(startingAmount(buildFood(), [medium, large])).toEqual({
      quantity: "1",
      unitValue: "portion-large",
    });
  });

  it("should start at 100 g when the food has no default portion", () => {
    expect(startingAmount(buildFood(), [medium])).toEqual({ quantity: "100", unitValue: "g" });
    expect(startingAmount(buildFood(), [])).toEqual({ quantity: "100", unitValue: "g" });
  });

  it("should start a drink with no portion at 100 ml", () => {
    expect(startingAmount(buildFood({ basis: "per_100ml" }), [])).toEqual({
      quantity: "100",
      unitValue: "ml",
    });
  });

  it("should start at the amount it is given, such as the one last logged", () => {
    expect(startingAmount(buildFood(), [medium, large], { unit: "g", quantity: 50 })).toEqual({
      quantity: "50",
      unitValue: "g",
    });
    expect(
      startingAmount(buildFood(), [medium, large], {
        unit: "portion",
        quantity: 2,
        portion: medium,
      }),
    ).toEqual({ quantity: "2", unitValue: "portion-medium" });
  });
});

describe("unitValueOf", () => {
  it("should name a portion by its id and a mass or volume by its unit", () => {
    expect(unitValueOf({ unit: "portion", quantity: 1, portion: medium })).toBe("portion-medium");
    expect(unitValueOf({ unit: "g", quantity: 5 })).toBe("g");
    expect(unitValueOf({ unit: "ml", quantity: 5 })).toBe("ml");
  });
});
