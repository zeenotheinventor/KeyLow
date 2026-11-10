import { describe, expect, it } from "vitest";

import { canBeCopiedToYourFoods } from "../../src/foods/canBeCopiedToYourFoods";
import { portionLabelOfFoodPerPortion } from "../../src/foods/portionLabelOfFoodPerPortion";

describe("canBeCopiedToYourFoods", () => {
  it("should be false for a food per portion, which a person cannot own", () => {
    expect(canBeCopiedToYourFoods({ basis: "per_portion" })).toBe(false);
  });

  it.each(["per_100g", "per_100ml"] as const)("should be true for a food %s", (basis) => {
    expect(canBeCopiedToYourFoods({ basis })).toBe(true);
  });
});

describe("portionLabelOfFoodPerPortion", () => {
  const portions = [
    { label: "6 nuggets", is_default: false },
    { label: "1 bucket", is_default: true },
  ];

  it("should be the default portion's label for a food per portion", () => {
    expect(portionLabelOfFoodPerPortion({ basis: "per_portion" }, portions)).toBe("1 bucket");
  });

  it("should be the first portion's label when none is the default", () => {
    expect(portionLabelOfFoodPerPortion({ basis: "per_portion" }, [{ label: "1 bucket" }])).toBe(
      "1 bucket",
    );
  });

  it("should be undefined when a food per portion has no portion yet", () => {
    expect(portionLabelOfFoodPerPortion({ basis: "per_portion" }, [])).toBeUndefined();
  });

  it("should be undefined for a food measured by weight, whose basis needs no label", () => {
    expect(portionLabelOfFoodPerPortion({ basis: "per_100g" }, portions)).toBeUndefined();
  });
});
