import { describe, expect, it } from "vitest";

import { banana, chickenAndRice, greekYoghurt } from "./sample";
import {
  addToPlate,
  clearPlate,
  plateItemName,
  plateItemOfHit,
  plateItemOfRecipe,
  removePlateItem,
  replacePlateItem,
  restorePlate,
  setPlateQuantity,
} from "../../src/plate";

import type { PlateItem } from "../../src/plate";

const yoghurt = (key: string) => plateItemOfHit(key, greekYoghurt);
const bananaRow = (key: string) => plateItemOfHit(key, banana);
const keysOf = (items: readonly PlateItem[]) => items.map((item) => item.key);

describe("addToPlate", () => {
  it("should put a new food at the end", () => {
    const plate = addToPlate([yoghurt("a")], bananaRow("b"));

    expect(keysOf(plate)).toEqual(["a", "b"]);
  });

  it("should add the quantities of the same food at the same unit into the existing row", () => {
    const plate = addToPlate([yoghurt("a"), bananaRow("b")], yoghurt("c"));

    expect(keysOf(plate)).toEqual(["a", "b"]);
    expect(plate[0]).toMatchObject({ key: "a", quantity: 2, quantityText: "2" });
  });

  it("should merge into the row in place, not move it to the end", () => {
    const plate = addToPlate([bananaRow("b"), yoghurt("a")], bananaRow("c"));

    expect(keysOf(plate)).toEqual(["b", "a"]);
    expect(plate[0]).toMatchObject({ quantity: 2 });
  });

  it("should make a new row for the same food at a different unit", () => {
    const grams = plateItemOfHit("g-row", {
      ...greekYoghurt,
      default_portion_id: null,
      default_portion_label: null,
      default_portion_grams: null,
    });
    const plate = addToPlate([yoghurt("a")], grams);

    expect(keysOf(plate)).toEqual(["a", "g-row"]);
  });

  it("should make a new row for a different portion of the same food", () => {
    const bigPot = plateItemOfHit("big", {
      ...greekYoghurt,
      default_portion_id: "other-portion",
      default_portion_label: "1 large pot",
    });

    expect(keysOf(addToPlate([yoghurt("a")], bigPot))).toEqual(["a", "big"]);
  });

  describe("a portion with no id (a Recent food whose portion was replaced)", () => {
    const noId = (key: string, label = "1 pot", amount = 170): PlateItem => ({
      ...yoghurt(key),
      unit: { kind: "portion", portionId: null, label, size: { amount, unit: "g" } },
    });

    it("should merge two rows with no id and the same label and size", () => {
      const plate = addToPlate([noId("a")], noId("b"));

      expect(keysOf(plate)).toEqual(["a"]);
      expect(plate[0]).toMatchObject({ quantity: 2 });
    });

    it("should not merge two rows with no id and different labels", () => {
      expect(keysOf(addToPlate([noId("a")], noId("b", "1 tub")))).toEqual(["a", "b"]);
    });

    it("should not merge two rows with no id and the same label at different sizes", () => {
      expect(keysOf(addToPlate([noId("a")], noId("b", "1 pot", 500)))).toEqual(["a", "b"]);
    });

    it("should merge a row with an id into one with none when the label and size match", () => {
      expect(keysOf(addToPlate([noId("a")], yoghurt("b")))).toEqual(["a"]);
      expect(keysOf(addToPlate([yoghurt("a")], noId("b")))).toEqual(["a"]);
    });

    it("should not merge a row with an id into one with none when the label differs", () => {
      expect(keysOf(addToPlate([noId("a", "1 tub")], yoghurt("b")))).toEqual(["a", "b"]);
    });

    it("should not merge two different ids even when the label and size match", () => {
      const other = plateItemOfHit("b", { ...greekYoghurt, default_portion_id: "other" });

      expect(keysOf(addToPlate([yoghurt("a")], other))).toEqual(["a", "b"]);
    });
  });

  it("should add recipe servings into the same recipe's row and keep grams apart", () => {
    const servings = plateItemOfRecipe({ key: "r1", recipe: chickenAndRice });
    const grams = plateItemOfRecipe({
      key: "r2",
      recipe: chickenAndRice,
      amount: { quantity: 100, unit: "g" },
    });
    const plate = addToPlate(
      addToPlate([servings], plateItemOfRecipe({ key: "r3", recipe: chickenAndRice })),
      grams,
    );

    expect(keysOf(plate)).toEqual(["r1", "r2"]);
    expect(plate[0]).toMatchObject({ quantity: 2 });
  });

  it("should not merge a recipe with a food", () => {
    const plate = addToPlate(
      [plateItemOfRecipe({ key: "r1", recipe: chickenAndRice })],
      yoghurt("a"),
    );

    expect(keysOf(plate)).toEqual(["r1", "a"]);
  });

  it("should not round the sum into a long decimal", () => {
    const first = { ...yoghurt("a"), quantity: 0.1, quantityText: "0.1" };
    const second = { ...yoghurt("b"), quantity: 0.2, quantityText: "0.2" };

    expect(addToPlate([first], second)[0]).toMatchObject({ quantity: 0.3, quantityText: "0.3" });
  });

  it("should take the added quantity when the row's amount is not valid", () => {
    const [emptied] = setPlateQuantity([yoghurt("a")], "a", "");

    expect(addToPlate(emptied === undefined ? [] : [emptied], yoghurt("b"))[0]).toMatchObject({
      quantity: 1,
      quantityText: "1",
    });
  });

  it("should not change the plate it was given", () => {
    const before = [yoghurt("a")];
    addToPlate(before, yoghurt("b"));

    expect(before[0]).toMatchObject({ quantity: 1 });
  });
});

describe("setPlateQuantity", () => {
  const plate = [yoghurt("a"), bananaRow("b")];

  it("should set the typed text and the number it reads as", () => {
    expect(setPlateQuantity(plate, "b", "3")[1]).toMatchObject({ quantityText: "3", quantity: 3 });
  });

  it("should read a decimal comma as the picker does", () => {
    expect(setPlateQuantity(plate, "b", "1,5")[1]).toMatchObject({ quantity: 1.5 });
    expect(setPlateQuantity(plate, "b", "1.5")[1]).toMatchObject({ quantity: 1.5 });
  });

  it.each(["", "  ", "0", "-2", "abc", "1e3", "1,000"])(
    "should keep %j as typed and read it as no valid amount",
    (text) => {
      expect(setPlateQuantity(plate, "b", text)[1]).toMatchObject({
        quantityText: text,
        quantity: 0,
      });
    },
  );

  it("should leave the other rows alone", () => {
    expect(setPlateQuantity(plate, "b", "3")[0]).toBe(plate[0]);
  });

  it("should change nothing for a key that is not on the plate", () => {
    expect(setPlateQuantity(plate, "missing", "3")).toEqual(plate);
  });
});

describe("replacePlateItem", () => {
  it("should swap the row for the picker's item in place and keep the row's key", () => {
    const grams = plateItemOfHit("new-key", {
      ...banana,
      default_portion_id: null,
      default_portion_label: null,
      default_portion_grams: null,
    });
    const plate = replacePlateItem([yoghurt("a"), bananaRow("b"), yoghurt("c")], "b", grams);

    expect(keysOf(plate)).toEqual(["a", "b", "c"]);
    expect(plate[1]).toMatchObject({ foodId: banana.id, unit: { kind: "g" }, quantity: 100 });
  });

  it("should not merge into another row of the same food and unit", () => {
    const plate = replacePlateItem(
      [bananaRow("a"), plateItemOfHit("b", { ...banana, id: "other" })],
      "b",
      bananaRow("x"),
    );

    expect(plate).toHaveLength(2);
    expect(plate.map((item) => item.kind === "food" && item.foodId)).toEqual([
      banana.id,
      banana.id,
    ]);
  });
});

describe("removePlateItem", () => {
  it("should take the row off the plate", () => {
    expect(keysOf(removePlateItem([yoghurt("a"), bananaRow("b")], "a"))).toEqual(["b"]);
  });

  it("should leave an empty plate when the last row goes", () => {
    expect(removePlateItem([yoghurt("a")], "a")).toEqual([]);
  });
});

describe("clearPlate and restorePlate", () => {
  it("should empty the plate and hand back what was cleared", () => {
    const plate = [yoghurt("a"), bananaRow("b")];

    expect(clearPlate(plate)).toEqual({ items: [], cleared: plate });
  });

  it("should put the cleared rows back, in their order", () => {
    const { items, cleared } = clearPlate([yoghurt("a"), bananaRow("b")]);

    expect(restorePlate(items, cleared)).toEqual(cleared);
  });

  it("should keep a food added since the clear, after the restored rows", () => {
    const { items, cleared } = clearPlate([yoghurt("a")]);
    const restored = restorePlate(addToPlate(items, bananaRow("b")), cleared);

    expect(keysOf(restored)).toEqual(["a", "b"]);
  });
});

describe("plateItemName", () => {
  it("should be the food's name or the recipe's", () => {
    expect(plateItemName(yoghurt("a"))).toBe("Greek yoghurt 0% fat");
    expect(plateItemName(plateItemOfRecipe({ key: "r", recipe: chickenAndRice }))).toBe(
      "Chicken and rice",
    );
  });
});
