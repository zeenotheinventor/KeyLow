import { describe, expect, it } from "vitest";

import { entryQuantityChange } from "../../src/diary/entryQuantityChange";
import { SNAPSHOT_PORTION_ID } from "../../src/diary/snapshotAmount";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFoodPortion } from "../../src/testing";

describe("entryQuantityChange", () => {
  it("should pass on a gram amount as it is", () => {
    expect(entryQuantityChange({ unit: "g", quantity: 120 })).toEqual({ quantity: 120, unit: "g" });
  });

  it("should keep the entry's own portion when the amount is on its chip", () => {
    const own = { id: SNAPSHOT_PORTION_ID, label: "1 medium", grams: 100, ml: null };

    expect(entryQuantityChange({ unit: "portion", quantity: 2, portion: own })).toEqual({
      quantity: 2,
      unit: "portion",
    });
  });

  it("should write a spoon by its label and size, with no link", () => {
    const [, tablespoon] = SPOON_PORTIONS;
    if (tablespoon === undefined) {
      throw new Error("The spoon portions must hold a tablespoon");
    }

    expect(entryQuantityChange({ unit: "portion", quantity: 2, portion: tablespoon })).toEqual({
      quantity: 2,
      unit: "portion",
      portion: { label: "1 tbsp", ml: 15 },
    });
  });

  it("should write a cup by its label and size, with no link, as it writes a spoon", () => {
    const cup = SPOON_PORTIONS.find((spoon) => spoon.id === "spoon-cup");
    if (cup === undefined) {
      throw new Error("The spoon portions must hold a cup");
    }

    expect(entryQuantityChange({ unit: "portion", quantity: 2, portion: cup })).toEqual({
      quantity: 2,
      unit: "portion",
      portion: { label: "1 cup", ml: 240 },
    });
  });

  it("should treat a stored 1 cup row of 240 ml as the generated cup, with no link, as it does a stored 15 ml 1 tbsp", () => {
    const storedCup = buildFoodPortion({ id: "portion-cup", label: "1 cup", grams: null, ml: 240 });
    const storedTablespoon = buildFoodPortion({
      id: "portion-tbsp",
      label: "1 tbsp",
      grams: null,
      ml: 15,
    });

    expect(entryQuantityChange({ unit: "portion", quantity: 1, portion: storedCup })).toEqual({
      quantity: 1,
      unit: "portion",
      portion: { label: "1 cup", ml: 240 },
    });
    expect(
      entryQuantityChange({ unit: "portion", quantity: 1, portion: storedTablespoon }),
    ).toEqual({
      quantity: 1,
      unit: "portion",
      portion: { label: "1 tbsp", ml: 15 },
    });
  });

  it("should write another portion of the food with its id, label and grams", () => {
    const large = buildFoodPortion({ id: "portion-large", label: "1 large", grams: 140 });

    expect(entryQuantityChange({ unit: "portion", quantity: 1, portion: large })).toEqual({
      quantity: 1,
      unit: "portion",
      portion: { label: "1 large", grams: 140 },
      portionId: "portion-large",
    });
  });

  it("should write a millilitre portion of the food with its millilitres", () => {
    const glass = buildFoodPortion({ id: "portion-glass", label: "1 glass", grams: null, ml: 200 });

    expect(entryQuantityChange({ unit: "portion", quantity: 1, portion: glass })).toEqual({
      quantity: 1,
      unit: "portion",
      portion: { label: "1 glass", ml: 200 },
      portionId: "portion-glass",
    });
  });

  it("should refuse a portion that has neither grams nor millilitres, with no value in the message", () => {
    const sizeless = buildFoodPortion({
      id: "portion-bad",
      label: "1 mystery",
      grams: null,
      ml: null,
    });

    expect(() => entryQuantityChange({ unit: "portion", quantity: 3, portion: sizeless })).toThrow(
      new RangeError("A portion needs a size in grams or millilitres"),
    );
  });
});
