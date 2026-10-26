import { describe, expect, it } from "vitest";

import { greekYoghurt, semiSkimmedMilk } from "./sample";
import { plateFoodAmount, plateItemOfHit, setPlateQuantity } from "../../src/plate";
import { buildFoodPortion } from "../../src/testing";

import type { PlateFoodItem } from "../../src/plate";

const pot = buildFoodPortion({
  id: greekYoghurt.default_portion_id ?? "",
  label: "1 pot",
  grams: 170,
});

function foodRow(row: ReturnType<typeof plateItemOfHit>, text: string): PlateFoodItem {
  const [item] = setPlateQuantity([row], row.key, text);
  if (item === undefined || item.kind !== "food") {
    throw new Error("The sample row should be a food");
  }
  return item;
}

describe("plateFoodAmount", () => {
  const item = foodRow(plateItemOfHit("pot", greekYoghurt), "2");

  it("should be the portion by its id", () => {
    expect(plateFoodAmount(item, [pot])).toEqual({ quantity: 2, unit: "portion", portion: pot });
  });

  it("should be the portion with the same label when the id is gone", () => {
    const reinserted = buildFoodPortion({ id: "new-id", label: "1 pot", grams: 170 });

    expect(plateFoodAmount(item, [reinserted])).toEqual({
      quantity: 2,
      unit: "portion",
      portion: reinserted,
    });
  });

  it("should prefer the id over a portion that only shares the label", () => {
    const lookalike = buildFoodPortion({ id: "other", label: "1 pot", grams: 500 });

    expect(plateFoodAmount(item, [lookalike, pot])).toMatchObject({ portion: pot });
  });

  it("should be the same weight in grams when the portion is gone", () => {
    const otherPortion = buildFoodPortion({ id: "x", label: "1 tub", grams: 500 });

    expect(plateFoodAmount(item, [otherPortion])).toEqual({ quantity: 340, unit: "g" });
    expect(plateFoodAmount(item, [])).toEqual({ quantity: 340, unit: "g" });
  });

  it("should be the same volume in millilitres when the portion was measured in millilitres", () => {
    const glass = foodRow(
      plateItemOfHit("glass", {
        ...semiSkimmedMilk,
        default_portion_id: "glass-id",
        default_portion_label: "1 glass",
        default_portion_ml: 250,
      }),
      "2",
    );

    expect(plateFoodAmount(glass, [])).toEqual({ quantity: 500, unit: "ml" });
  });

  it("should keep a spoon as a spoon, since a spoon is no row of the food", () => {
    const spoons = foodRow(
      {
        ...plateItemOfHit("spoon", semiSkimmedMilk),
        unit: {
          kind: "portion",
          portionId: "spoon-tbsp",
          label: "1 tbsp",
          size: { amount: 15, unit: "ml" },
        },
      },
      "2",
    );

    expect(plateFoodAmount(spoons, [])).toMatchObject({
      quantity: 2,
      unit: "portion",
      portion: { id: "spoon-tbsp", ml: 15 },
    });
  });

  it("should be grams and millilitres as they are", () => {
    const grams = foodRow(
      plateItemOfHit("g", {
        ...greekYoghurt,
        default_portion_id: null,
        default_portion_label: null,
      }),
      "150",
    );

    expect(plateFoodAmount(grams, [pot])).toEqual({ quantity: 150, unit: "g" });
    expect(plateFoodAmount(foodRow(plateItemOfHit("ml", semiSkimmedMilk), "250"), [])).toEqual({
      quantity: 250,
      unit: "ml",
    });
  });

  it("should be nothing while the row's amount is not valid", () => {
    expect(
      plateFoodAmount(foodRow(plateItemOfHit("pot", greekYoghurt), ""), [pot]),
    ).toBeUndefined();
  });
});
