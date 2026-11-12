import { describe, expect, it } from "vitest";

import { amountForPicker, amountLastLogged } from "../../src/diary/amountLastLogged";
import { buildFoodSnapshot } from "../../src/diary/buildFoodSnapshot";
import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { entryQuantityChange } from "../../src/diary/entryQuantityChange";
import { foodChangedSinceLogged } from "../../src/diary/foodChangedSinceLogged";
import { pickerChoices } from "../../src/diary/pickerChoices";
import { previewAmount } from "../../src/diary/previewAmount";
import { recomputeEntry, refreshEntryFromFood } from "../../src/diary/recomputeEntry";
import { foodSnapshotSchema, logEntryInsertSchema } from "../../src/diary/schemas";
import {
  entryPickerChoices,
  snapshotAmountStart,
  snapshotAsFood,
} from "../../src/diary/snapshotAmount";
import { nutrientsOfSnapshot } from "../../src/diary/snapshotQuantity";
import { startingAmount } from "../../src/diary/startingAmount";
import { scaleNutrients } from "../../src/nutrition/scale";
import { servingOfSearchHit } from "../../src/search";
import { buildFood, buildFoodPortion } from "../../src/testing";

const bucket = buildFood({
  id: "00000000-0000-4000-8000-0000000000f1",
  source: "restaurant",
  name: "Bargain bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
  fibre_g: null,
});
const bucketPortion = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000f2",
  food_id: bucket.id,
  label: "1 bucket",
  grams: null,
  ml: null,
  is_default: true,
});
const countPortion = { label: "1 bucket", grams: null, ml: null };

const loggedBucket = (quantity: number) =>
  buildLogEntry({
    food: bucket,
    quantity,
    unit: "portion",
    portion: bucketPortion,
    loggedAt: "2026-11-10T12:00:00+00:00",
    localDate: "2026-11-10",
  });

describe("a per portion food", () => {
  describe("the arithmetic", () => {
    it("should give the same 750 kcal for 1.5 portions through scaleNutrients, the snapshot and the preview", () => {
      const scaled = scaleNutrients(
        { kcal: 500, protein_g: 40, fat_g: 30, carbs_g: 20, fibre_g: null },
        1.5,
        "per_portion",
      );
      const snapshot = buildFoodSnapshot(bucket, {
        quantity: 1.5,
        unit: "portion",
        portion: countPortion,
      });
      const preview = previewAmount(bucket, [bucketPortion], bucketPortion.id, "1.5");

      expect(scaled.kcal).toBe(750);
      expect(nutrientsOfSnapshot(snapshot).kcal).toBe(750);
      expect(preview.hero.values?.kcal).toBe(750);
    });

    it("should give the food's own 500 kcal for the one portion a search row shows", () => {
      const serving = servingOfSearchHit({
        basis: "per_portion",
        kcal: 500,
        protein_g: 40,
        fat_g: 30,
        carbs_g: 20,
        default_portion_id: bucketPortion.id,
        default_portion_label: "1 bucket",
        default_portion_grams: null,
        default_portion_ml: null,
      });

      expect(serving.kcal).toBe(500);
      expect(
        nutrientsOfSnapshot(
          buildFoodSnapshot(bucket, { quantity: 1, unit: "portion", portion: countPortion }),
        ).kcal,
      ).toBe(500);
    });
  });

  describe("the snapshot", () => {
    const snapshot = buildFoodSnapshot(bucket, {
      quantity: 1.5,
      unit: "portion",
      portion: countPortion,
    });

    it("should hold one portion's values in per100, a label-only portion and no weight", () => {
      expect(snapshot).toMatchObject({
        basis: "per_portion",
        per100: { kcal: 500, protein_g: 40, fat_g: 30, carbs_g: 20 },
        unit: "portion",
        quantity: 1.5,
        portion: { label: "1 bucket" },
        density: null,
        resolvedGrams: 0,
      });
      expect(snapshot.portion).toEqual({ label: "1 bucket" });
    });

    it("should parse against its own schema", () => {
      expect(foodSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    });

    it("should give no density, even for a food whose group has an estimate", () => {
      const dairy = { ...bucket, food_group: "milk" };

      expect(
        buildFoodSnapshot(dairy, { quantity: 1, unit: "portion", portion: countPortion }).density,
      ).toBeNull();
    });

    it.each(["g", "ml", "oz", "fl_oz"] as const)("should refuse to be logged in %s", (unit) => {
      expect(() => buildFoodSnapshot(bucket, { quantity: 100, unit })).toThrow(RangeError);
    });

    it("should refuse a portion that has a weight", () => {
      expect(() =>
        buildFoodSnapshot(bucket, {
          quantity: 1,
          unit: "portion",
          portion: { label: "1 bucket", grams: 400, ml: null },
        }),
      ).toThrow(RangeError);
    });

    it("should still refuse a count portion on a food measured by weight", () => {
      expect(() =>
        buildFoodSnapshot(buildFood(), { quantity: 1, unit: "portion", portion: countPortion }),
      ).toThrow(RangeError);
    });
  });

  describe("the snapshot schema", () => {
    const valid = buildFoodSnapshot(bucket, {
      quantity: 1,
      unit: "portion",
      portion: countPortion,
    });

    it("should refuse a label-only portion on a food measured by weight", () => {
      expect(
        foodSnapshotSchema.safeParse({ ...valid, basis: "per_100g", resolvedGrams: 100 }).success,
      ).toBe(false);
    });

    it("should refuse a portion with a weight on a per portion food", () => {
      expect(
        foodSnapshotSchema.safeParse({ ...valid, portion: { label: "1 bucket", grams: 400 } })
          .success,
      ).toBe(false);
    });

    it("should refuse a per portion food logged in grams", () => {
      expect(
        foodSnapshotSchema.safeParse({ ...valid, unit: "g", portion: null, quantity: 100 }).success,
      ).toBe(false);
    });

    it.each([
      ["a gram portion", { label: "1 medium", grams: 100 }, "portion"],
      ["a millilitre portion", { label: "1 cup", ml: 240 }, "portion"],
      ["no portion", null, "g"],
    ] as const)(
      "should still parse a food measured by weight logged with %s",
      (_name, portion, unit) => {
        const existing = {
          ...valid,
          basis: "per_100g",
          unit,
          portion,
          quantity: 2,
          resolvedGrams: 200,
        };

        expect(foodSnapshotSchema.parse(existing)).toEqual(existing);
      },
    );
  });

  describe("a log entry", () => {
    it("should be accepted by the insert schema with its count of portions and no grams", () => {
      const entry = loggedBucket(2);

      expect(logEntryInsertSchema.parse(entry)).toEqual(entry);
      expect(entry).toMatchObject({
        quantity: 2,
        unit: "portion",
        portion_id: bucketPortion.id,
        resolved_grams: 0,
        nutrients: { kcal: 1000 },
      });
    });

    it("should be recomputed to another count from its own snapshot", () => {
      const entry = recomputeEntry(loggedBucket(1), { quantity: 0.5, unit: "portion" });

      expect(entry.nutrients.kcal).toBe(250);
      expect(entry.snapshot.portion).toEqual({ label: "1 bucket" });
    });

    it("should refuse to be recomputed in grams", () => {
      expect(() => recomputeEntry(loggedBucket(1), { quantity: 100, unit: "g" })).toThrow(
        RangeError,
      );
    });

    it("should be refreshed from the food, landing on the portion with the same label", () => {
      const replaced = { ...bucketPortion, id: "00000000-0000-4000-8000-0000000000f3" };
      const refreshed = refreshEntryFromFood(loggedBucket(2), { ...bucket, kcal: 600 }, [replaced]);

      expect(refreshed.nutrients.kcal).toBe(1200);
      expect(refreshed.portion_id).toBe(replaced.id);
    });

    it("should be refreshed onto the food's one portion when its label changed", () => {
      const renamed = { ...bucketPortion, label: "1 large bucket" };
      const refreshed = refreshEntryFromFood(loggedBucket(2), bucket, [renamed]);

      expect(refreshed.snapshot.portion).toEqual({ label: "1 large bucket" });
      expect(refreshed.quantity).toBe(2);
    });
  });

  describe("whether the food changed since it was logged", () => {
    const logged = buildFoodSnapshot(bucket, {
      quantity: 1,
      unit: "portion",
      portion: countPortion,
    });

    it("should say it did not when it is the same food", () => {
      expect(foodChangedSinceLogged(bucket, logged, [bucketPortion])).toBe(false);
    });

    it("should say it did when a value changed", () => {
      expect(foodChangedSinceLogged({ ...bucket, kcal: 510 }, logged, [bucketPortion])).toBe(true);
    });
  });

  describe("the picker", () => {
    it("should offer only the portion chip, with no g or ml chip", () => {
      expect(pickerChoices(bucket, [bucketPortion]).options).toEqual([
        { value: bucketPortion.id, label: "1 bucket" },
      ]);
    });

    it("should offer no volume chips even when the food group has a density estimate", () => {
      const dairy = { ...bucket, food_group: "milk" };

      expect(pickerChoices(dairy, [bucketPortion]).options).toEqual([
        { value: bucketPortion.id, label: "1 bucket" },
      ]);
    });

    it("should offer only the portion chip on the edit screen, from the snapshot alone", () => {
      const { snapshot } = loggedBucket(1.5);

      expect(entryPickerChoices(snapshot).options).toEqual([
        { value: "snapshot-portion", label: "1 bucket" },
      ]);
    });

    it("should offer only the portion chip on the edit screen with the live portions", () => {
      const { snapshot } = loggedBucket(1.5);

      expect(
        entryPickerChoices(snapshot, {
          portions: [bucketPortion],
          loggedPortionId: bucketPortion.id,
        }).options,
      ).toEqual([{ value: "snapshot-portion", label: "1 bucket" }]);
    });

    it("should start at one of the default portion", () => {
      expect(startingAmount(bucket, [bucketPortion])).toEqual({
        quantity: "1",
        unitValue: bucketPortion.id,
      });
    });

    it("should caption one portion as '1 bucket' with no size in brackets", () => {
      const preview = previewAmount(bucket, [bucketPortion], bucketPortion.id, "1");

      expect(preview.hero.caption).toBe("For 1 bucket");
      expect(preview.hero.values?.kcal).toBe(500);
    });

    it("should caption several portions with the count and no size in brackets", () => {
      const preview = previewAmount(bucket, [bucketPortion], bucketPortion.id, "2");

      expect(preview.hero.caption).toBe("For 2 × 1 bucket");
      expect(preview.hero.caption).not.toMatch(/\(|\bg\b|ml/);
    });

    it("should give no amount for grams, which it cannot be measured in", () => {
      expect(previewAmount(bucket, [bucketPortion], "g", "100")).toEqual({
        amount: null,
        hero: { caption: "For this amount", values: null },
      });
    });

    it("should draw a logged entry from its own snapshot, on its one portion", () => {
      const { snapshot } = loggedBucket(1.5);

      expect(snapshotAmountStart(snapshot)).toEqual({
        quantity: "1.5",
        unitValue: "snapshot-portion",
      });
      expect(
        previewAmount(
          snapshotAsFood(snapshot),
          [{ id: "snapshot-portion", ...countPortion }],
          "snapshot-portion",
          "1.5",
        ).hero.values?.kcal,
      ).toBe(750);
    });
  });

  describe("log again", () => {
    const recent = (portionId: string | null) => ({
      portionId,
      snapshot: loggedBucket(2).snapshot,
    });

    it("should be the same count of the food's portion with the same link", () => {
      expect(amountLastLogged(recent(bucketPortion.id), [bucketPortion])).toEqual({
        quantity: 2,
        unit: "portion",
        portion: bucketPortion,
      });
    });

    it("should be the same count of the food's one portion when the label is gone", () => {
      const renamed = { ...bucketPortion, id: "other", label: "1 large bucket" };

      expect(amountLastLogged(recent(null), [renamed])).toEqual({
        quantity: 2,
        unit: "portion",
        portion: renamed,
      });
    });

    it("should hand the picker the portion as it is", () => {
      const amount = amountLastLogged(recent(bucketPortion.id), [bucketPortion]);

      expect(amountForPicker(amount)).toEqual(amount);
    });

    it("should refuse when the food has no count portion to land on", () => {
      expect(() => amountLastLogged(recent(null), [buildFoodPortion()])).toThrow(RangeError);
    });
  });

  describe("an amount chosen on the edit screen", () => {
    it("should write the count portion by its label with its link", () => {
      expect(entryQuantityChange({ unit: "portion", quantity: 2, portion: bucketPortion })).toEqual(
        {
          quantity: 2,
          unit: "portion",
          portion: { label: "1 bucket" },
          portionId: bucketPortion.id,
        },
      );
    });
  });
});
