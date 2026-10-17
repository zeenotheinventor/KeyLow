import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildRecipeLogEntry,
  nutrientsOfRecipeSnapshot,
  recipeLogEntryInsertSchema,
  recipeSnapshotSchema,
  recomputeRecipeEntry,
} from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe, RecipeLogEntryInsert } from "../../src/diary";
import type { NullableNutrients } from "../../src/schemas/nutrients";

const when = {
  localDate: "2026-10-17",
  loggedAt: "2026-10-17T12:30:00+01:00",
} as const;

/** What the database does to jsonb: serialise it and read it back, here through the entry schema. */
const throughJsonb = (entry: RecipeLogEntryInsert): RecipeLogEntryInsert =>
  recipeLogEntryInsertSchema.parse(JSON.parse(JSON.stringify(entry)));

const expectBitForBitEqual = (actual: NullableNutrients, expected: NullableNutrients) => {
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
  const actualByKey = new Map(Object.entries(actual));
  for (const [key, value] of Object.entries(expected)) {
    expect(Object.is(actualByKey.get(key), value), key).toBe(true);
  }
};

const chickenAndRice = (): LoggableRecipe => {
  const { servings, yieldGrams, ingredients } = buildChickenAndRiceRecipe({
    servings: 3,
    yieldGrams: 1034.7,
  });
  return {
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Chicken and rice",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

describe("the recipe immutability contract", () => {
  it("should rebuild nutrients from a stored snapshot bit for bit, after a jsonb round trip", () => {
    for (const [quantity, unit] of [
      [1.7, "serving"],
      [213.3, "g"],
    ] as const) {
      const built = buildRecipeLogEntry({ recipe: chickenAndRice(), quantity, unit, ...when });

      const stored = throughJsonb(built);

      expectBitForBitEqual(
        nutrientsOfRecipeSnapshot(recipeSnapshotSchema.parse(stored.snapshot)),
        built.nutrients,
      );
      expectBitForBitEqual(stored.nutrients, built.nutrients);
      expect(Object.is(stored.resolved_grams, built.resolved_grams)).toBe(true);
    }
  });

  it("should recompute the same amount from a stored entry to the same nutrients", () => {
    const built = buildRecipeLogEntry({
      recipe: chickenAndRice(),
      quantity: 2.3,
      unit: "serving",
      ...when,
    });

    const recomputed = recomputeRecipeEntry(throughJsonb(built), {
      quantity: 2.3,
      unit: "serving",
    });

    expectBitForBitEqual(recomputed.nutrients, built.nutrients);
    expect(recomputed.snapshot).toEqual(built.snapshot);
  });

  it("should not change an entry when the recipe is edited afterwards", () => {
    const recipe = chickenAndRice();
    const built = buildRecipeLogEntry({ recipe, quantity: 1.5, unit: "serving", ...when });
    const before = structuredClone(built);

    recipe.name = "Something else";
    recipe.servings = 8;
    recipe.yield_grams = 400;
    recipe.computed.effectiveGrams = 400;
    recipe.computed.total.kcal = 1;
    recipe.computed.total.protein_g = null;

    expect(built).toEqual(before);
    expectBitForBitEqual(built.nutrients, before.nutrients);
  });

  it("should recompute from the snapshot, not the edited recipe, so the same amount still matches", () => {
    const recipe = chickenAndRice();
    const built = buildRecipeLogEntry({ recipe, quantity: 1, unit: "serving", ...when });

    recipe.servings = 8;
    recipe.computed.effectiveGrams = 400;
    recipe.computed.total.kcal = 1;

    expect(recomputeRecipeEntry(built, { quantity: 1, unit: "serving" })).toEqual(built);
  });

  it("should hold for any recipe, quantity and unit", () => {
    const total = fc.double({ min: 0, max: 100_000, noNaN: true });
    const optionalTotal = fc.option(total, { nil: null });
    const optionalKey = fc.option(optionalTotal, { nil: undefined });
    fc.assert(
      fc.property(
        fc.record({
          kcal: total,
          protein_g: optionalTotal,
          fat_g: total,
          carbs_g: optionalTotal,
          fibre_g: optionalTotal,
        }),
        optionalKey,
        optionalKey,
        optionalKey,
        fc.double({ min: 0.01, max: 1000, noNaN: true }),
        fc.double({ min: 1, max: 100_000, noNaN: true }),
        fc.option(fc.double({ min: 1, max: 100_000, noNaN: true }), { nil: null }),
        fc.double({ min: 0, max: 1000, noNaN: true }),
        fc.constantFrom("serving", "g"),
        (
          required,
          saturates,
          sugars,
          salt,
          servings,
          effectiveGrams,
          yieldGrams,
          quantity,
          unit,
        ) => {
          const recipe: LoggableRecipe = {
            id: "00000000-0000-4000-8000-0000000000b1",
            name: "Any recipe",
            servings,
            yield_grams: yieldGrams,
            computed: {
              effectiveGrams,
              total: {
                ...required,
                ...(saturates === undefined ? {} : { sat_fat_g: saturates }),
                ...(sugars === undefined ? {} : { sugars_g: sugars }),
                ...(salt === undefined ? {} : { salt_g: salt }),
              },
            },
          };
          const built = buildRecipeLogEntry({ recipe, quantity, unit, ...when });

          const recomputed = recomputeRecipeEntry(throughJsonb(built), { quantity, unit });

          expectBitForBitEqual(recomputed.nutrients, built.nutrients);
          expect(Object.is(recomputed.resolved_grams, built.resolved_grams)).toBe(true);
        },
      ),
    );
  });
});
