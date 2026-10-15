import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { previewAmount } from "../../src/diary/previewAmount";
import {
  SNAPSHOT_PORTION_ID,
  snapshotAmountStart,
  snapshotAsFood,
  snapshotPortions,
} from "../../src/diary/snapshotAmount";
import { unitOptions } from "../../src/diary/startingAmount";
import { buildFood, buildFoodPortion } from "../../src/testing";

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
