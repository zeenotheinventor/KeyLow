import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { previewAmount } from "../../src/diary/previewAmount";
import {
  SNAPSHOT_PORTION_ID,
  entryPickerChoices,
  snapshotAmountStart,
  snapshotAsFood,
  snapshotPortions,
} from "../../src/diary/snapshotAmount";
import { unitOptions } from "../../src/diary/startingAmount";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFood, buildFoodPortion } from "../../src/testing";

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must be a teaspoon and a tablespoon");
}

const when = { loggedAt: "2026-10-15T11:40:00+00:00", localDate: "2026-10-15" };
const banana = buildFood({
  name: "Banana",
  kcal: 95,
  protein_g: 1.2,
  carbs_g: 20.3,
  fat_g: 0.1,
  fibre_g: 2,
});
const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });

const inGrams = buildLogEntry({ food: banana, quantity: 150, unit: "g", ...when }).snapshot;
const inPortions = buildLogEntry({
  food: banana,
  quantity: 2,
  unit: "portion",
  portion: medium,
  ...when,
}).snapshot;

describe("snapshotAsFood", () => {
  it("should give the values the entry was logged with, per its basis", () => {
    expect(snapshotAsFood(inGrams)).toMatchObject({
      basis: "per_100g",
      kcal: 95,
      protein_g: 1.2,
      carbs_g: 20.3,
      fat_g: 0.1,
      fibre_g: 2,
    });
  });

  it("should carry the density the entry was logged with", () => {
    const drink = buildLogEntry({
      food: buildFood({ basis: "per_100ml", density_g_per_ml: 1.03 }),
      quantity: 200,
      unit: "ml",
      ...when,
    }).snapshot;

    expect(snapshotAsFood(drink)).toMatchObject({ basis: "per_100ml", density_g_per_ml: 1.03 });
  });
});

describe("snapshotPortions", () => {
  it("should be empty for an entry logged in grams", () => {
    expect(snapshotPortions(inGrams)).toEqual([]);
  });

  it("should give the portion the entry was logged with, under one fixed id", () => {
    expect(snapshotPortions(inPortions)).toEqual([
      { id: SNAPSHOT_PORTION_ID, label: "1 medium", grams: 100, ml: null },
    ]);
  });

  it("should read a portion measured in millilitres", () => {
    const glass = buildFoodPortion({ id: "portion-glass", label: "1 glass", grams: null, ml: 200 });
    const drink = buildLogEntry({
      food: buildFood({ basis: "per_100ml" }),
      quantity: 1,
      unit: "portion",
      portion: glass,
      ...when,
    }).snapshot;

    expect(snapshotPortions(drink)).toEqual([
      { id: SNAPSHOT_PORTION_ID, label: "1 glass", grams: null, ml: 200 },
    ]);
  });
});

describe("what an entry's own snapshot lets the dialog offer", () => {
  it("should offer the snapshot's portion, then g", () => {
    expect(unitOptions(snapshotAsFood(inPortions), snapshotPortions(inPortions))).toEqual([
      { value: SNAPSHOT_PORTION_ID, label: "1 medium" },
      { value: "g", label: "g" },
    ]);
  });

  it("should work out a new amount from the snapshot alone", () => {
    const { amount, hero } = previewAmount(
      snapshotAsFood(inPortions),
      snapshotPortions(inPortions),
      "g",
      "250",
    );

    expect(amount).toEqual({ unit: "g", quantity: 250 });
    expect(hero.caption).toBe("For 250 g");
    expect(hero.values?.kcal).toBeCloseTo(237.5);
  });
});

describe("snapshotAmountStart", () => {
  it("should start at the logged amount in grams", () => {
    expect(snapshotAmountStart(inGrams)).toEqual({ quantity: "150", unitValue: "g" });
  });

  it("should start at the logged portions, on the portion's chip", () => {
    expect(snapshotAmountStart(inPortions)).toEqual({
      quantity: "2",
      unitValue: SNAPSHOT_PORTION_ID,
    });
  });

  it("should start at millilitres for a drink logged in millilitres", () => {
    const drink = buildLogEntry({
      food: buildFood({ basis: "per_100ml" }),
      quantity: 250,
      unit: "ml",
      ...when,
    }).snapshot;

    expect(snapshotAmountStart(drink)).toEqual({ quantity: "250", unitValue: "ml" });
  });

  it("should show an amount logged in ounces as grams, to a tenth", () => {
    const ounces = buildLogEntry({ food: banana, quantity: 2, unit: "oz", ...when }).snapshot;

    expect(snapshotAmountStart(ounces)).toEqual({ quantity: "56.7", unitValue: "g" });
  });

  it("should show an amount logged in fluid ounces as millilitres, to a tenth", () => {
    const drink = buildLogEntry({
      food: buildFood({ basis: "per_100ml" }),
      quantity: 4,
      unit: "fl_oz",
      ...when,
    }).snapshot;

    expect(snapshotAmountStart(drink)).toEqual({ quantity: "118.3", unitValue: "ml" });
  });
});

describe("entryPickerChoices", () => {
  const oil = buildFood({ density_g_per_ml: 0.92, kcal: 884, fat_g: 100 });
  const spoonEntry = buildLogEntry({
    food: oil,
    quantity: 2,
    unit: "portion",
    portion: tablespoon,
    ...when,
  }).snapshot;

  const countBy = (
    choices: ReturnType<typeof entryPickerChoices>,
    key: "value" | "label",
    wanted: string,
  ) => choices.options.filter((option) => option[key] === wanted).length;

  describe("an entry logged in spoons", () => {
    it("should show the spoon chip once, in the spoon's place, and start on it", () => {
      const choices = entryPickerChoices(spoonEntry);

      expect(choices.options).toEqual([
        { value: "g", label: "g" },
        { value: "ml", label: "ml" },
        { value: "spoon-tsp", label: "1 tsp" },
        { value: "spoon-tbsp", label: "1 tbsp" },
      ]);
      expect(countBy(choices, "value", "spoon-tbsp")).toBe(1);
      expect(countBy(choices, "label", "1 tbsp")).toBe(1);
      expect(snapshotAmountStart(spoonEntry)).toEqual({ quantity: "2", unitValue: "spoon-tbsp" });
    });

    it("should hold the spoon portions the hero works from, whose size is the entry's", () => {
      const { portions } = entryPickerChoices(spoonEntry);
      const { amount, hero } = previewAmount(
        snapshotAsFood(spoonEntry),
        portions,
        "spoon-tbsp",
        "3",
      );

      expect(portions).toContainEqual(tablespoon);
      expect(amount).not.toBeNull();
      expect(hero.caption).toBe("For 3 tbsp (45 ml, 41 g)");
    });

    it("should do the same for a teaspoon", () => {
      const teaspoonEntry = buildLogEntry({
        food: oil,
        quantity: 1,
        unit: "portion",
        portion: teaspoon,
        ...when,
      }).snapshot;

      expect(entryPickerChoices(teaspoonEntry).options.map((option) => option.value)).toEqual([
        "g",
        "ml",
        "spoon-tsp",
        "spoon-tbsp",
      ]);
      expect(snapshotAmountStart(teaspoonEntry).unitValue).toBe("spoon-tsp");
    });

    it("should offer the spoons of a per 100 ml food that has no density", () => {
      const drinkEntry = buildLogEntry({
        food: buildFood({ basis: "per_100ml", density_g_per_ml: null }),
        quantity: 2,
        unit: "portion",
        portion: tablespoon,
        ...when,
      }).snapshot;

      expect(entryPickerChoices(drinkEntry).options.map((option) => option.label)).toEqual([
        "g",
        "ml",
        "1 tsp",
        "1 tbsp",
      ]);
      expect(snapshotAmountStart(drinkEntry).unitValue).toBe("spoon-tbsp");
    });
  });

  describe("a gram portion that shares a spoon's label", () => {
    it("should keep two chips, its own and the spoon, and start on its own", () => {
      const ownTablespoon = buildFoodPortion({ id: "portion-own", label: "1 tbsp", grams: 14 });
      const entry = buildLogEntry({
        food: oil,
        quantity: 2,
        unit: "portion",
        portion: ownTablespoon,
        ...when,
      }).snapshot;

      const choices = entryPickerChoices(entry);

      expect(choices.options).toEqual([
        { value: SNAPSHOT_PORTION_ID, label: "1 tbsp" },
        { value: "g", label: "g" },
        { value: "ml", label: "ml" },
        { value: "spoon-tsp", label: "1 tsp" },
        { value: "spoon-tbsp", label: "1 tbsp" },
      ]);
      expect(snapshotAmountStart(entry).unitValue).toBe(SNAPSHOT_PORTION_ID);
    });
  });

  describe("an old entry", () => {
    it("should give the chips unitOptions gives today for an entry logged in grams", () => {
      expect(entryPickerChoices(inGrams).options).toEqual(
        unitOptions(snapshotAsFood(inGrams), snapshotPortions(inGrams)),
      );
    });

    it("should give the chips unitOptions gives today for an entry logged in a portion", () => {
      expect(entryPickerChoices(inPortions).options).toEqual(
        unitOptions(snapshotAsFood(inPortions), snapshotPortions(inPortions)),
      );
      expect(entryPickerChoices(inPortions).portions).toEqual(snapshotPortions(inPortions));
    });

    it("should give a drink in millilitres g, ml and the spoons", () => {
      const drink = buildLogEntry({
        food: buildFood({ basis: "per_100ml" }),
        quantity: 250,
        unit: "ml",
        ...when,
      }).snapshot;

      expect(entryPickerChoices(drink).options.map((option) => option.label)).toEqual([
        "g",
        "ml",
        "1 tsp",
        "1 tbsp",
      ]);
    });

    it("should keep the logged millilitre portion of a drink before g", () => {
      const glass = buildFoodPortion({
        id: "portion-glass",
        label: "1 glass",
        grams: null,
        ml: 200,
      });
      const drink = buildLogEntry({
        food: buildFood({ basis: "per_100ml" }),
        quantity: 1,
        unit: "portion",
        portion: glass,
        ...when,
      }).snapshot;

      expect(entryPickerChoices(drink).options.map((option) => option.label)).toEqual([
        "1 glass",
        "g",
        "ml",
        "1 tsp",
        "1 tbsp",
      ]);
    });
  });

  it("should offer ml and the spoons of a food whose density the entry froze", () => {
    const frozen = buildLogEntry({ food: oil, quantity: 100, unit: "g", ...when }).snapshot;

    expect(entryPickerChoices(frozen).options.map((option) => option.label)).toEqual([
      "g",
      "ml",
      "1 tsp",
      "1 tbsp",
    ]);
  });
});
