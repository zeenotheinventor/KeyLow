import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { recomputeEntry } from "../../src/diary/recomputeEntry";
import { foodLogEntryInsertSchema, foodSnapshotSchema } from "../../src/diary/schemas";
import { scaleNutrients } from "../../src/nutrition/scale";
import { resolveQuantity } from "../../src/nutrition/units";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { FoodLogEntryInsert } from "../../src/diary/schemas";
import type { NullableNutrients } from "../../src/schemas/nutrients";

const when = {
  localDate: "2026-10-15",
  loggedAt: "2026-10-15T12:30:00+01:00",
} as const;

/** What the database does to jsonb: serialise it and read it back, here through the entry schema. */
const throughJsonb = (entry: FoodLogEntryInsert): FoodLogEntryInsert =>
  foodLogEntryInsertSchema.parse(JSON.parse(JSON.stringify(entry)));

const expectBitForBitEqual = (actual: NullableNutrients, expected: NullableNutrients) => {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  const actualByKey = new Map(Object.entries(actual));
  for (const [key, value] of Object.entries(expected)) {
    expect(Object.is(actualByKey.get(key), value), key).toBe(true);
  }
};

describe("the immutability contract", () => {
  it("should rebuild nutrients from a stored snapshot bit for bit, after a jsonb round trip", () => {
    const food = buildFood({
      basis: "per_100ml",
      density_g_per_ml: 1.03,
      kcal: 64.3,
      protein_g: 3.37,
      fat_g: 1.8,
      carbs_g: 4.7,
      fibre_g: null,
      sat_fat_g: 1.1,
      sugars_g: 4.7,
      salt_g: null,
    });
    const built = buildLogEntry({ food, quantity: 250, unit: "g", ...when });

    const stored = throughJsonb(built);
    const snapshot = foodSnapshotSchema.parse(stored.snapshot);
    const { amount } = resolveQuantity(
      { basis: snapshot.basis, density_g_per_ml: snapshot.density },
      snapshot.quantity,
      snapshot.unit,
      snapshot.portion === null ? undefined : { grams: null, ml: null, ...snapshot.portion },
    );

    expectBitForBitEqual(scaleNutrients(snapshot.per100, amount), built.nutrients);
    expectBitForBitEqual(stored.nutrients, built.nutrients);
  });

  it("should recompute the same quantity from a stored entry to the same nutrients", () => {
    const portion = buildFoodPortion({ label: "Slice", grams: 35 });
    const food = buildFood({ kcal: 250.7, protein_g: 9.1, sat_fat_g: 0.7 });
    const built = buildLogEntry({ food, quantity: 2.5, unit: "portion", portion, ...when });

    const recomputed = recomputeEntry(throughJsonb(built), {
      quantity: built.quantity,
      unit: built.unit,
    });

    expectBitForBitEqual(recomputed.nutrients, built.nutrients);
    expect(recomputed.snapshot).toEqual(built.snapshot);
  });

  it("should hold for any food, quantity and unit, including portions", () => {
    const amount = fc.double({ min: 0, max: 900, noNaN: true });
    const optional = fc.option(amount, { nil: null });
    const portionSize = fc.double({ min: 1, max: 500, noNaN: true });
    fc.assert(
      fc.property(
        amount,
        amount,
        optional,
        fc.double({ min: 0.5, max: 3, noNaN: true }),
        fc.constantFrom("g", "ml", "oz", "fl_oz", "portion"),
        fc.constantFrom("per_100g", "per_100ml"),
        portionSize,
        fc.boolean(),
        (kcal, quantity, saturates, density, unit, basis, size, isMillilitres) => {
          const food = buildFood({ kcal, sat_fat_g: saturates, basis, density_g_per_ml: density });
          const portion = buildFoodPortion(
            isMillilitres
              ? { label: "Portion", grams: null, ml: size }
              : { label: "Portion", grams: size, ml: null },
          );
          const built = buildLogEntry({ food, quantity, unit, portion, ...when });

          const recomputed = recomputeEntry(throughJsonb(built), { quantity, unit });

          expectBitForBitEqual(recomputed.nutrients, built.nutrients);
          expect(Object.is(recomputed.resolved_grams, built.resolved_grams)).toBe(true);
        },
      ),
    );
  });
});
