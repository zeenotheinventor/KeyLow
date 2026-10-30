import { describe, expect, it } from "vitest";

import {
  amountOnUnitChange,
  reselectPickedUnit,
  reselectUnit,
  startingAmount,
  unitValueOf,
  usualQuantityOfUnit,
} from "../../src/diary/startingAmount";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFood, buildFoodPortion } from "../../src/testing";

const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });
const large = buildFoodPortion({
  id: "portion-large",
  label: "1 large",
  grams: 150,
  is_default: true,
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

describe("startingAmount when the amount it is given names a unit the picker does not offer", () => {
  const [teaspoon, tablespoon] = SPOON_PORTIONS;
  if (teaspoon === undefined || tablespoon === undefined) {
    throw new Error("The spoon portions must be a teaspoon and a tablespoon");
  }
  const lastInSpoons = { unit: "portion", quantity: 2, portion: tablespoon } as const;

  it("should keep a spoon amount when the picker offers the spoons", () => {
    expect(startingAmount(buildFood(), [tablespoon], lastInSpoons)).toEqual({
      quantity: "2",
      unitValue: "spoon-tbsp",
    });
  });

  it("should start at the default when the food lost its density, so no spoon is offered", () => {
    expect(startingAmount(buildFood(), [medium, large], lastInSpoons)).toEqual({
      quantity: "1",
      unitValue: "portion-large",
    });
  });

  it("should start at 100 g when the lost spoon leaves a food with no default portion", () => {
    expect(startingAmount(buildFood(), [], lastInSpoons)).toEqual({
      quantity: "100",
      unitValue: "g",
    });
  });

  it("should start at the default when the last amount was in a portion the food no longer has", () => {
    expect(
      startingAmount(buildFood(), [large], { unit: "portion", quantity: 3, portion: medium }),
    ).toEqual({ quantity: "1", unitValue: "portion-large" });
  });

  it("should not take ml for a food that is not measured by volume", () => {
    expect(startingAmount(buildFood(), [large], { unit: "ml", quantity: 250 })).toEqual({
      quantity: "1",
      unitValue: "portion-large",
    });
  });

  it("should take ml for a food measured per 100 ml", () => {
    expect(
      startingAmount(buildFood({ basis: "per_100ml" }), [], { unit: "ml", quantity: 250 }),
    ).toEqual({ quantity: "250", unitValue: "ml" });
  });

  it("should take ml for a food whose spoons are offered, because it can be measured by volume", () => {
    expect(
      startingAmount(buildFood({ density_g_per_ml: 0.92 }), SPOON_PORTIONS, {
        unit: "ml",
        quantity: 250,
      }),
    ).toEqual({ quantity: "250", unitValue: "ml" });
  });

  it("should always take g", () => {
    expect(startingAmount(buildFood(), [], { unit: "g", quantity: 40 })).toEqual({
      quantity: "40",
      unitValue: "g",
    });
  });
});

describe("amountOnUnitChange", () => {
  it("should give 1 when g changes to a portion", () => {
    expect(amountOnUnitChange("g", "portion-medium", "100")).toBe("1");
  });

  it("should give 1 when g changes to a spoon", () => {
    expect(amountOnUnitChange("g", "spoon-tbsp", "100")).toBe("1");
  });

  it("should give 100 when a portion changes to g", () => {
    expect(amountOnUnitChange("portion-medium", "g", "1")).toBe("100");
  });

  it("should give 100 when g changes to ml", () => {
    expect(amountOnUnitChange("g", "ml", "250")).toBe("100");
  });

  it("should give 1 when ml changes to a spoon", () => {
    expect(amountOnUnitChange("ml", "spoon-tsp", "100")).toBe("1");
  });

  it("should give 1 when one portion changes to another", () => {
    expect(amountOnUnitChange("portion-medium", "portion-large", "3")).toBe("1");
  });

  it("should keep the amount, typed text and all, when the same unit is pressed again", () => {
    expect(amountOnUnitChange("g", "g", "250")).toBe("250");
    expect(amountOnUnitChange("spoon-tbsp", "spoon-tbsp", "2.5")).toBe("2.5");
    expect(amountOnUnitChange("g", "g", "")).toBe("");
  });

  it("should replace a typed 2.5 on a real change", () => {
    expect(amountOnUnitChange("portion-medium", "g", "2.5")).toBe("100");
    expect(amountOnUnitChange("g", "portion-medium", "2.5")).toBe("1");
  });
});

describe("reselectUnit", () => {
  const bar = { value: "new-bar", label: "1 bar" };
  const box = { value: "new-box", label: "Box of 6" };
  const gram = { value: "g", label: "g" };
  const chosen = { unitValue: "old-bar", label: "1 bar", quantityText: "2.5" };

  it("should stay on the chip it is on, with the typed amount, while the chip is still offered", () => {
    expect(reselectUnit({ ...chosen, unitValue: "new-bar" }, [bar, box, gram], "new-box")).toEqual({
      unitValue: "new-bar",
      quantity: "2.5",
    });
  });

  it("should move to the chip with the same label and keep the typed amount when the id is gone", () => {
    expect(reselectUnit(chosen, [box, bar, gram], "new-box")).toEqual({
      unitValue: "new-bar",
      quantity: "2.5",
    });
  });

  it("should fall back to the given unit and reset the amount when no chip has the label", () => {
    expect(reselectUnit(chosen, [box, gram], "new-box")).toEqual({
      unitValue: "new-box",
      quantity: "1",
    });
  });

  it("should reset the amount to 100 when the fallback is g", () => {
    expect(reselectUnit(chosen, [gram], "g")).toEqual({ unitValue: "g", quantity: "100" });
  });
});

describe("reselectPickedUnit", () => {
  const bar = { value: "new-bar", label: "1 bar" };
  const box = { value: "new-box", label: "Box of 6" };
  const gram = { value: "g", label: "g" };

  it("should give nothing when no chip was picked", () => {
    expect(reselectPickedUnit(undefined, [bar, box, gram], "new-box")).toBeUndefined();
  });

  it("should give the picked chip and the typed amount back while the chip is offered", () => {
    const picked = { unitValue: "new-bar", label: "1 bar", quantityText: "2.5" };

    expect(reselectPickedUnit(picked, [bar, box, gram], "new-box")).toEqual({
      unitValue: "new-bar",
      quantity: "2.5",
    });
  });

  it("should find the chip again by its label when its id is gone, keeping the typed amount", () => {
    const picked = { unitValue: "old-bar", label: "1 bar", quantityText: "2.5" };

    expect(reselectPickedUnit(picked, [box, bar, gram], "new-box")).toEqual({
      unitValue: "new-bar",
      quantity: "2.5",
    });
  });

  it("should move to the starting chip and start the amount again when no chip has the label", () => {
    const picked = { unitValue: "old-bar", label: "1 bar", quantityText: "2.5" };

    expect(reselectPickedUnit(picked, [box, gram], "new-box")).toEqual({
      unitValue: "new-box",
      quantity: "1",
    });
  });
});

describe("usualQuantityOfUnit", () => {
  it.each(["g", "ml"] as const)("should be 100 for %s", (unit) => {
    expect(usualQuantityOfUnit(unit)).toBe(100);
  });

  it.each(["portion", "serving"] as const)(
    "should be 1 for a %s, a spoon being a portion",
    (unit) => {
      expect(usualQuantityOfUnit(unit)).toBe(1);
    },
  );

  it("should agree with the amount a unit chip starts at", () => {
    expect(String(usualQuantityOfUnit("ml"))).toBe(amountOnUnitChange("g", "ml", "5"));
    expect(String(usualQuantityOfUnit("portion"))).toBe(
      amountOnUnitChange("g", "portion-medium", "5"),
    );
  });
});
