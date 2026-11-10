import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary";
import {
  addToPlate,
  plateFoodAmount,
  plateItemOfHit,
  plateItemOfPickedFood,
  plateItemOfRecent,
  plateUnitWords,
} from "../../src/plate";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { PlateFoodItem } from "../../src/plate";

const bucket = buildFood({
  id: "00000000-0000-4000-8000-0000000000f1",
  source: "restaurant",
  name: "Bargain bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
});
const bucketPortion = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000f2",
  food_id: bucket.id,
  label: "1 bucket",
  grams: null,
  ml: null,
  is_default: true,
});
const bucketHit = {
  id: bucket.id,
  name: bucket.name,
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
  default_portion_id: bucketPortion.id,
  default_portion_label: "1 bucket",
  default_portion_grams: null,
  default_portion_ml: null,
} as const;

function foodItemOf(item: ReturnType<typeof plateItemOfHit>): PlateFoodItem {
  return item;
}

describe("a per portion food on the plate", () => {
  it("should be 1 of its portion from a search row, with no size and the values of one portion", () => {
    const item = foodItemOf(plateItemOfHit("row-1", bucketHit));

    expect(item.unit).toEqual({
      kind: "portion",
      portionId: bucketPortion.id,
      label: "1 bucket",
    });
    expect(item.perUnit.kcal).toBe(500);
  });

  it("should be the portion the picker chose, with no size", () => {
    const item = plateItemOfPickedFood({
      key: "row-2",
      food: bucket,
      portions: [bucketPortion],
      amount: { unit: "portion", quantity: 2, portion: bucketPortion },
    });

    expect(item.unit).toEqual({ kind: "portion", portionId: bucketPortion.id, label: "1 bucket" });
    expect(item.perUnit.kcal).toBe(500);
  });

  it("should be the amount last logged, from its own snapshot, with no size", () => {
    const snapshot = buildFoodSnapshot(bucket, {
      quantity: 2,
      unit: "portion",
      portion: bucketPortion,
    });
    const item = plateItemOfRecent("row-3", { foodId: bucket.id, portionId: null, snapshot });

    expect(item).toMatchObject({
      quantity: 2,
      unit: { kind: "portion", portionId: null, label: "1 bucket" },
    });
    expect(item.perUnit.kcal).toBe(500);
  });

  it("should merge with the same portion added again, even with no link", () => {
    const snapshot = buildFoodSnapshot(bucket, {
      quantity: 1,
      unit: "portion",
      portion: bucketPortion,
    });
    const recent = plateItemOfRecent("a", { foodId: bucket.id, portionId: null, snapshot });
    const again = plateItemOfRecent("b", { foodId: bucket.id, portionId: null, snapshot });

    expect(addToPlate([recent], again)).toHaveLength(1);
  });

  it("should be logged as the same count of the food's portion", () => {
    const item = plateItemOfHit("row-4", bucketHit);

    expect(plateFoodAmount(item, [bucketPortion])).toEqual({
      quantity: 1,
      unit: "portion",
      portion: bucketPortion,
    });
  });

  it("should be worded by the noun of its portion", () => {
    expect(plateUnitWords(plateItemOfHit("row-5", bucketHit))).toEqual({
      singular: "bucket",
      plural: "buckets",
    });
  });
});
