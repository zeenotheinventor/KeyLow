import { describe, expect, it } from "vitest";

import { buildLogEntry, buildQuickEntry } from "../../src/diary/buildLogEntry";
import { logEntryInsertSchema } from "../../src/diary/schemas";
import { buildFood, buildFoodPortion } from "../../src/testing";

const bread = buildFood({
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Bread",
  kcal: 250,
  protein_g: 10,
  fat_g: 5,
  carbs_g: 50,
});
const milk = buildFood({
  id: "00000000-0000-4000-8000-0000000000b2",
  name: "Milk",
  basis: "per_100ml",
  density_g_per_ml: 1.03,
  kcal: 64,
});
const oliveOil = buildFood({
  id: "00000000-0000-4000-8000-0000000000b3",
  name: "Olive oil",
  density_g_per_ml: 0.91,
  kcal: 884,
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

describe("buildLogEntry", () => {
  it("should build an insert-ready food entry", () => {
    const entry = buildLogEntry({ food: bread, quantity: 80, unit: "g", ...when });

    expect(entry).toEqual({
      item_type: "food",
      local_date: "2026-10-15",
      logged_at: "2026-10-15T07:30:00+01:00",
      food_id: "00000000-0000-4000-8000-0000000000b1",
      quantity: 80,
      unit: "g",
      portion_id: null,
      resolved_grams: 80,
      snapshot: {
        v: 1,
        kind: "food",
        ref: "00000000-0000-4000-8000-0000000000b1",
        name: "Bread",
        basis: "per_100g",
        per100: { kcal: 250, protein_g: 10, fat_g: 5, carbs_g: 50, fibre_g: null },
        quantity: 80,
        unit: "g",
        portion: null,
        density: null,
        resolvedGrams: 80,
        engineVersion: 1,
      },
      nutrients: {
        kcal: 200,
        protein_g: 8,
        fat_g: 4,
        carbs_g: 40,
        fibre_g: null,
      },
    });
  });

  it("should produce an entry its own schema accepts", () => {
    const entry = buildLogEntry({
      food: bread,
      quantity: 2,
      unit: "portion",
      portion: slice,
      ...when,
    });

    expect(logEntryInsertSchema.parse(entry)).toEqual(entry);
  });

  it("should give 175 kcal for 2 slices of 35 g at 250 kcal per 100 g", () => {
    const entry = buildLogEntry({
      food: bread,
      quantity: 2,
      unit: "portion",
      portion: slice,
      ...when,
    });

    expect(entry.nutrients.kcal).toBeCloseTo(175, 9);
  });

  it("should give 160 kcal for 250 ml of milk at 64 kcal per 100 ml", () => {
    const entry = buildLogEntry({ food: milk, quantity: 250, unit: "ml", ...when });

    expect(entry.nutrients.kcal).toBe(160);
  });

  it("should give 155.34 kcal for 250 g of milk at a density of 1.03", () => {
    const entry = buildLogEntry({ food: milk, quantity: 250, unit: "g", ...when });

    // The build plan rounds this to 155.34.
    expect(entry.nutrients.kcal).toBeCloseTo(155.339805825, 8);
    expect(entry.resolved_grams).toBe(250);
  });

  it("should give 120.666 kcal for 1 tablespoon of 15 ml olive oil, which the build plan quotes truncated as 120.66", () => {
    const tablespoon = buildFoodPortion({ label: "Tablespoon", grams: null, ml: 15 });

    const entry = buildLogEntry({
      food: oliveOil,
      quantity: 1,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });

    expect(entry.nutrients.kcal).toBeCloseTo(120.666, 9);
  });

  describe("portion_id", () => {
    it("should be the portion id for the portion unit", () => {
      const entry = buildLogEntry({
        food: bread,
        quantity: 2,
        unit: "portion",
        portion: slice,
        ...when,
      });

      expect(entry.portion_id).toBe("00000000-0000-4000-8000-0000000000c1");
    });

    it("should be null for g, with a null snapshot portion", () => {
      const entry = buildLogEntry({
        food: bread,
        quantity: 80,
        unit: "g",
        portion: slice,
        ...when,
      });

      expect(entry.portion_id).toBeNull();
      expect(entry.snapshot.portion).toBeNull();
    });

    it("should be null for ml", () => {
      const entry = buildLogEntry({ food: milk, quantity: 250, unit: "ml", ...when });

      expect(entry.portion_id).toBeNull();
    });
  });

  describe("nutrients", () => {
    it("should keep a null required nutrient as null", () => {
      const entry = buildLogEntry({
        food: buildFood({ protein_g: null }),
        quantity: 100,
        unit: "g",
        ...when,
      });

      expect(entry.nutrients.protein_g).toBeNull();
    });

    it("should leave out an optional nutrient the food does not record", () => {
      const entry = buildLogEntry({
        food: buildFood({ sat_fat_g: null, sugars_g: 4, salt_g: null }),
        quantity: 50,
        unit: "g",
        ...when,
      });

      expect(entry.nutrients).toEqual({
        kcal: 50,
        protein_g: 5,
        fat_g: 2.5,
        carbs_g: 10,
        fibre_g: null,
        sugars_g: 2,
      });
      expect(Object.keys(entry.nutrients)).not.toContain("sat_fat_g");
      expect(Object.keys(entry.nutrients)).not.toContain("salt_g");
    });
  });
});

describe("the entry time", () => {
  it.each([
    {
      name: "the local day is earlier than the UTC day (23:30 at -05:00 is already the 16th in UTC)",
      loggedAt: "2026-10-15T23:30:00-05:00",
      localDate: "2026-10-15",
    },
    {
      name: "the local day is later than the UTC day (06:00 at +13:00 is still the 15th in UTC)",
      loggedAt: "2026-10-16T06:00:00+13:00",
      localDate: "2026-10-16",
    },
  ])("should store the instant and the local date as given when $name", (timing) => {
    const food = buildLogEntry({ food: bread, quantity: 80, unit: "g", ...timing });
    const quick = buildQuickEntry({ kcal: 100, ...timing });

    expect(food).toMatchObject({ local_date: timing.localDate, logged_at: timing.loggedAt });
    expect(quick).toMatchObject({ local_date: timing.localDate, logged_at: timing.loggedAt });
  });
});

describe("buildQuickEntry", () => {
  it("should build a quick entry with the label in the snapshot", () => {
    const entry = buildQuickEntry({
      kcal: 450,
      protein_g: 20,
      label: "Work sandwich",
      ...when,
    });

    expect(entry).toEqual({
      item_type: "quick",
      local_date: "2026-10-15",
      logged_at: "2026-10-15T07:30:00+01:00",
      food_id: null,
      quantity: null,
      unit: null,
      portion_id: null,
      resolved_grams: null,
      snapshot: { v: 1, kind: "quick", label: "Work sandwich" },
      nutrients: { kcal: 450, protein_g: 20, fat_g: null, carbs_g: null, fibre_g: null },
    });
  });

  it("should store a null label when none is given", () => {
    const entry = buildQuickEntry({ kcal: 100, ...when });

    expect(entry.snapshot).toEqual({ v: 1, kind: "quick", label: null });
  });

  it("should store a null label when the label is blank", () => {
    const entry = buildQuickEntry({ kcal: 100, label: "   ", ...when });

    expect(entry.snapshot.label).toBeNull();
  });

  it("should trim the label", () => {
    const entry = buildQuickEntry({ kcal: 100, label: "  Crisps  ", ...when });

    expect(entry.snapshot.label).toBe("Crisps");
  });

  it("should keep a macro of zero as zero, not null", () => {
    const entry = buildQuickEntry({ kcal: 100, fat_g: 0, ...when });

    expect(entry.nutrients.fat_g).toBe(0);
  });

  it("should produce an entry its own schema accepts", () => {
    const entry = buildQuickEntry({ kcal: 100, label: "Crisps", ...when });

    expect(logEntryInsertSchema.parse(entry)).toEqual(entry);
  });
});

describe("logEntryInsertSchema", () => {
  const valid = buildLogEntry({ food: bread, quantity: 80, unit: "g", ...when });

  it("should reject a logged time without an offset, because it is not an instant", () => {
    const floating = { ...valid, logged_at: "2026-10-15T07:30:00" };

    expect(logEntryInsertSchema.safeParse(floating).success).toBe(false);
  });

  it("should accept a logged time in UTC", () => {
    const utc = { ...valid, logged_at: "2026-10-15T06:30:00Z" };

    expect(logEntryInsertSchema.safeParse(utc).success).toBe(true);
  });

  it("should reject a local date that is not a calendar date", () => {
    expect(logEntryInsertSchema.safeParse({ ...valid, local_date: "15/10/2026" }).success).toBe(
      false,
    );
  });

  it("should reject a portion_id on an entry whose unit is not portion", () => {
    const withLink = { ...valid, portion_id: "00000000-0000-4000-8000-0000000000c1" };

    expect(logEntryInsertSchema.safeParse(withLink).success).toBe(false);
  });

  it("should reject a food entry that carries a quick snapshot", () => {
    const mixed = { ...valid, snapshot: { v: 1, kind: "quick", label: null } };

    expect(logEntryInsertSchema.safeParse(mixed).success).toBe(false);
  });

  it("should reject an item type that is not food or quick", () => {
    expect(logEntryInsertSchema.safeParse({ ...valid, item_type: "recipe" }).success).toBe(false);
  });
});
