import { describe, expect, it } from "vitest";

import { buildFoodSnapshot } from "../../src/diary/buildFoodSnapshot";
import { refreshSnapshotFromFood } from "../../src/diary/refreshSnapshotFromFood";
import { buildFood, buildFoodPortion } from "../../src/testing";

const bread = buildFood({
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Bread",
  kcal: 250,
});
const slice = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000c1",
  food_id: bread.id,
  label: "Slice",
  grams: 40,
});

describe("refreshSnapshotFromFood", () => {
  it("should take the live food and keep the quantity and unit", () => {
    const stale = buildFoodSnapshot(bread, { quantity: 80, unit: "g" });

    const refreshed = refreshSnapshotFromFood(stale, null, { ...bread, kcal: 300 }, []);

    expect(refreshed.snapshot.per100.kcal).toBe(300);
    expect(refreshed.snapshot.quantity).toBe(80);
    expect(refreshed.snapshot.unit).toBe("g");
    expect(refreshed.portionId).toBeNull();
    expect(refreshed.portionFellBack).toBe(false);
  });

  it("should keep a portion that is still on the food, with its live size and id", () => {
    const stale = buildFoodSnapshot(bread, { quantity: 2, unit: "portion", portion: slice });

    const refreshed = refreshSnapshotFromFood(stale, slice.id, bread, [{ ...slice, grams: 50 }]);

    expect(refreshed.snapshot.portion).toStrictEqual({ label: "Slice", grams: 50 });
    expect(refreshed.portionId).toBe(slice.id);
    expect(refreshed.portionFellBack).toBe(false);
  });

  it("should fall back to a direct amount and say so when the portion is gone", () => {
    const stale = buildFoodSnapshot(bread, { quantity: 2, unit: "portion", portion: slice });

    const refreshed = refreshSnapshotFromFood(stale, slice.id, bread, []);

    expect(refreshed.snapshot.unit).toBe("g");
    expect(refreshed.snapshot.quantity).toBe(80);
    expect(refreshed.snapshot.portion).toBeNull();
    expect(refreshed.portionId).toBeNull();
    expect(refreshed.portionFellBack).toBe(true);
  });

  it("should refuse a food that is not the one the snapshot was frozen from", () => {
    const stale = buildFoodSnapshot(bread, { quantity: 80, unit: "g" });

    expect(() => refreshSnapshotFromFood(stale, null, buildFood(), [])).toThrow(RangeError);
  });
});
