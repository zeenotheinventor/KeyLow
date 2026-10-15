import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { recomputeEntry, refreshEntryFromFood } from "../../src/diary/recomputeEntry";
import { buildFood, buildFoodPortion } from "../../src/testing";

const bread = buildFood({
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Bread",
  kcal: 250,
  protein_g: 9,
  fat_g: 3,
  carbs_g: 48,
});
const milk = buildFood({
  id: "00000000-0000-4000-8000-0000000000b2",
  name: "Milk",
  basis: "per_100ml",
  density_g_per_ml: 1.03,
  kcal: 64,
});
const slice = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000c1",
  label: "Slice",
  grams: 35,
});
const when = {
  localDate: "2026-10-15",
  loggedAt: "2026-10-15T07:30:00+01:00",
} as const;

const breadEntry = buildLogEntry({ food: bread, quantity: 80, unit: "g", ...when });

describe("recomputeEntry", () => {
  it("should recompute nutrients from the entry's own snapshot", () => {
    const entry = recomputeEntry(breadEntry, { quantity: 160, unit: "g" });

    expect(entry.nutrients.kcal).toBe(400);
    expect(entry.quantity).toBe(160);
    expect(entry.resolved_grams).toBe(160);
    expect(entry.snapshot.quantity).toBe(160);
    expect(entry.snapshot.resolvedGrams).toBe(160);
  });

  it("should take only the entry and the change, so no live food can reach it", () => {
    // The guarantee is structural: a third parameter would be where a food could come in.
    expect(recomputeEntry).toHaveLength(2);
  });

  it("should use the per 100 values and the name frozen in the snapshot", () => {
    const entry = recomputeEntry(breadEntry, { quantity: 100, unit: "g" });

    expect(entry.nutrients.kcal).toBe(250);
    expect(entry.snapshot.per100.kcal).toBe(250);
    expect(entry.snapshot.name).toBe("Bread");
  });

  it("should keep the timing, the food and the extra columns of the entry", () => {
    const stored = { ...breadEntry, id: "row-id", user_id: "user-id" };

    const entry = recomputeEntry(stored, { quantity: 160, unit: "g" });

    expect(entry).toMatchObject({
      id: "row-id",
      user_id: "user-id",
      local_date: "2026-10-15",
      logged_at: "2026-10-15T07:30:00+01:00",
      food_id: "00000000-0000-4000-8000-0000000000b1",
    });
  });

  it("should not change the entry it was given", () => {
    const before = JSON.stringify(breadEntry);

    recomputeEntry(breadEntry, { quantity: 160, unit: "g" });

    expect(JSON.stringify(breadEntry)).toBe(before);
  });

  it("should use the snapshot density to convert from grams to millilitres of a liquid", () => {
    const milkEntry = buildLogEntry({ food: milk, quantity: 250, unit: "ml", ...when });

    const entry = recomputeEntry(milkEntry, { quantity: 250, unit: "g" });

    // The build plan rounds this to 155.34.
    expect(entry.nutrients.kcal).toBeCloseTo(155.339805825, 8);
  });

  describe("portion", () => {
    const sliceEntry = buildLogEntry({
      food: bread,
      quantity: 2,
      unit: "portion",
      portion: slice,
      ...when,
    });

    it("should keep the snapshot portion and the link when only the quantity changes", () => {
      const entry = recomputeEntry(sliceEntry, { quantity: 3, unit: "portion" });

      expect(entry.snapshot.portion).toStrictEqual({ label: "Slice", grams: 35 });
      expect(entry.portion_id).toBe("00000000-0000-4000-8000-0000000000c1");
      expect(entry.resolved_grams).toBe(105);
      expect(entry.nutrients.kcal).toBeCloseTo(262.5, 9);
    });

    it("should use a changed portion in the snapshot shape and drop the link it cannot know", () => {
      const entry = recomputeEntry(sliceEntry, {
        quantity: 1,
        unit: "portion",
        portion: { label: "Roll", grams: 60 },
      });

      expect(entry.snapshot.portion).toStrictEqual({ label: "Roll", grams: 60 });
      expect(entry.portion_id).toBeNull();
      expect(entry.resolved_grams).toBe(60);
    });

    it("should keep a link the caller supplies with a changed portion", () => {
      const entry = recomputeEntry(sliceEntry, {
        quantity: 1,
        unit: "portion",
        portion: { label: "Roll", grams: 60 },
        portionId: "00000000-0000-4000-8000-0000000000c2",
      });

      expect(entry.portion_id).toBe("00000000-0000-4000-8000-0000000000c2");
    });

    it("should clear the portion and the link when the unit changes to grams", () => {
      const entry = recomputeEntry(sliceEntry, { quantity: 70, unit: "g" });

      expect(entry.snapshot.portion).toBeNull();
      expect(entry.portion_id).toBeNull();
    });

    it("should set a portion on an entry that was logged in grams", () => {
      const entry = recomputeEntry(breadEntry, {
        quantity: 2,
        unit: "portion",
        portion: { label: "Slice", grams: 35 },
        portionId: "00000000-0000-4000-8000-0000000000c1",
      });

      expect(entry.snapshot.portion).toStrictEqual({ label: "Slice", grams: 35 });
      expect(entry.portion_id).toBe("00000000-0000-4000-8000-0000000000c1");
    });

    it("should throw when the portion unit has no portion to use", () => {
      expect(() => recomputeEntry(breadEntry, { quantity: 2, unit: "portion" })).toThrow(
        RangeError,
      );
    });
  });
});

describe("refreshEntryFromFood", () => {
  const stalePortionless = buildLogEntry({ food: bread, quantity: 80, unit: "g", ...when });
  const sliceEntry = buildLogEntry({
    food: bread,
    quantity: 2,
    unit: "portion",
    portion: slice,
    ...when,
  });

  it("should take the live food's nutrients and keep the entry's quantity and unit", () => {
    const liveBread = buildFood({ ...bread, name: "Bread (new recipe)", kcal: 300 });

    const entry = refreshEntryFromFood(stalePortionless, liveBread, []);

    expect(entry.nutrients.kcal).toBe(240);
    expect(entry.quantity).toBe(80);
    expect(entry.unit).toBe("g");
    expect(entry.snapshot.name).toBe("Bread (new recipe)");
    expect(entry.snapshot.per100.kcal).toBe(300);
  });

  it("should keep the timing and the extra columns", () => {
    const stored = { ...stalePortionless, id: "row-id" };

    const entry = refreshEntryFromFood(stored, bread, []);

    expect(entry).toMatchObject({ id: "row-id", local_date: "2026-10-15" });
  });

  it("should refuse a food that is not the entry's food", () => {
    expect(() => refreshEntryFromFood(stalePortionless, milk, [])).toThrow(RangeError);
  });

  it("should drop an optional nutrient the live food no longer records", () => {
    const withSugar = buildLogEntry({
      food: buildFood({ ...bread, sugars_g: 4 }),
      quantity: 100,
      unit: "g",
      ...when,
    });

    const entry = refreshEntryFromFood(withSugar, buildFood({ ...bread, sugars_g: null }), []);

    expect(Object.keys(entry.nutrients)).not.toContain("sugars_g");
  });

  describe("when the entry was logged with a portion", () => {
    it("should use the portion the link still points to, with its live size", () => {
      const biggerSlice = buildFoodPortion({ ...slice, grams: 40 });

      const entry = refreshEntryFromFood(sliceEntry, bread, [biggerSlice]);

      expect(entry.unit).toBe("portion");
      expect(entry.snapshot.portion).toStrictEqual({ label: "Slice", grams: 40 });
      expect(entry.portion_id).toBe(slice.id);
      expect(entry.resolved_grams).toBe(80);
    });

    it("should match by label when the link no longer exists", () => {
      const reinserted = buildFoodPortion({
        id: "00000000-0000-4000-8000-0000000000c9",
        label: "Slice",
        grams: 38,
      });
      const orphaned = { ...sliceEntry, portion_id: null };

      const entry = refreshEntryFromFood(orphaned, bread, [
        buildFoodPortion({
          id: "00000000-0000-4000-8000-0000000000c8",
          label: "Roll",
          grams: 60,
          is_default: true,
        }),
        reinserted,
      ]);

      expect(entry.portion_id).toBe("00000000-0000-4000-8000-0000000000c9");
      expect(entry.quantity).toBe(2);
      expect(entry.resolved_grams).toBe(76);
    });

    it("should ignore the default portion and keep the amount when no label matches", () => {
      const orphaned = { ...sliceEntry, portion_id: null };
      const defaultRoll = buildFoodPortion({
        id: "00000000-0000-4000-8000-0000000000c8",
        label: "Roll",
        grams: 60,
        is_default: true,
      });

      const entry = refreshEntryFromFood(orphaned, bread, [defaultRoll]);

      expect(entry.unit).toBe("g");
      expect(entry.quantity).toBe(70);
      expect(entry.portion_id).toBeNull();
      expect(entry.snapshot.portion).toBeNull();
    });

    it("should fall back to grams, keeping the amount, when the food has no usable portion", () => {
      const orphaned = { ...sliceEntry, portion_id: null };

      const entry = refreshEntryFromFood(orphaned, bread, []);

      expect(entry.unit).toBe("g");
      expect(entry.quantity).toBe(70);
      expect(entry.portion_id).toBeNull();
      expect(entry.snapshot.portion).toBeNull();
    });

    it("should fall back to millilitres for a millilitre portion", () => {
      const glass = buildFoodPortion({
        id: "00000000-0000-4000-8000-0000000000d1",
        label: "Glass",
        grams: null,
        ml: 200,
      });
      const glassEntry = buildLogEntry({
        food: milk,
        quantity: 1.5,
        unit: "portion",
        portion: glass,
        ...when,
      });

      const entry = refreshEntryFromFood({ ...glassEntry, portion_id: null }, milk, []);

      expect(entry.unit).toBe("ml");
      expect(entry.quantity).toBe(300);
    });
  });
});
