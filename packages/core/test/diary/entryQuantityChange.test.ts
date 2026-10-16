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
    const cup = buildFoodPortion({ id: "portion-cup", label: "1 cup", grams: null, ml: 240 });

    expect(entryQuantityChange({ unit: "portion", quantity: 1, portion: cup })).toEqual({
      quantity: 1,
      unit: "portion",
      portion: { label: "1 cup", ml: 240 },
      portionId: "portion-cup",
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
