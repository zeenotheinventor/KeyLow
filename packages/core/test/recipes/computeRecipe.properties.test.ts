import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildRecipeIngredient, computeRecipe } from "../../src/recipes";
import { buildFood } from "../../src/testing";

import type { RecipeIngredient } from "../../src/recipes";
import type { NullableNutrients } from "../../src/schemas";

type NutrientKey = keyof NullableNutrients;

const nutrientKeys: readonly NutrientKey[] = [
  "kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "fibre_g",
  "sat_fat_g",
  "sugars_g",
  "salt_g",
];

type Item = { per100: Record<NutrientKey, number | null>; grams: number };

const per100Amount = fc.double({ min: 0, max: 900, noNaN: true });
const gramsAmount = fc.double({ min: 0.1, max: 5000, noNaN: true });
const servingsAmount = fc.double({ min: 0.01, max: 1000, noNaN: true });
const yieldAmount = fc.double({ min: 1, max: 100000, noNaN: true });

const knownPer100: fc.Arbitrary<Item["per100"]> = fc.record({
  kcal: per100Amount,
  protein_g: per100Amount,
  fat_g: per100Amount,
  carbs_g: per100Amount,
  fibre_g: per100Amount,
  sat_fat_g: per100Amount,
  sugars_g: per100Amount,
  salt_g: per100Amount,
});

const maybePer100: fc.Arbitrary<Item["per100"]> = fc.record({
  kcal: fc.option(per100Amount, { nil: null }),
  protein_g: fc.option(per100Amount, { nil: null }),
  fat_g: fc.option(per100Amount, { nil: null }),
  carbs_g: fc.option(per100Amount, { nil: null }),
  fibre_g: fc.option(per100Amount, { nil: null }),
  sat_fat_g: fc.option(per100Amount, { nil: null }),
  sugars_g: fc.option(per100Amount, { nil: null }),
  salt_g: fc.option(per100Amount, { nil: null }),
});

const itemsOf = (per100: fc.Arbitrary<Item["per100"]>) =>
  fc.array(fc.record({ per100, grams: gramsAmount }), { minLength: 1, maxLength: 8 });

const ingredientOf = (item: Item): RecipeIngredient =>
  buildRecipeIngredient(buildFood(item.per100), { quantity: item.grams, unit: "g" });

const ingredientsOf = (items: readonly Item[]): RecipeIngredient[] => items.map(ingredientOf);

/** What the maths should give for one nutrient, worked out from the per 100 values directly: a null is skipped. */
const expectedTotal = (items: readonly Item[], key: NutrientKey): number | null => {
  const known = items.flatMap((item) => {
    const value = item.per100[key];
    return value === null ? [] : [(value * item.grams) / 100];
  });
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0);
};

const expectClose = (actual: number | null | undefined, expected: number | null, label: string) => {
  if (expected === null) {
    expect(actual ?? null, label).toBeNull();
    return;
  }
  expect(actual, label).not.toBeUndefined();
  expect(actual, label).not.toBeNull();
  expect(Math.abs((actual ?? Number.NaN) - expected), label).toBeLessThanOrEqual(
    1e-9 * Math.max(1, Math.abs(expected)),
  );
};

const expectNutrientsClose = (actual: NullableNutrients, expected: NullableNutrients) => {
  for (const key of nutrientKeys) {
    expectClose(actual[key], expected[key] ?? null, key);
  }
};

/** Works the total back out of a figure derived from it: a null derived figure means the total was null. */
const expectTotalFrom = (
  total: NullableNutrients,
  derived: NullableNutrients,
  backToTotal: (value: number) => number,
) => {
  for (const key of nutrientKeys) {
    const value = derived[key];
    expectClose(total[key], value === null || value === undefined ? null : backToTotal(value), key);
  }
};

const computeFrom = (
  items: readonly Item[],
  options: { servings?: number; yieldGrams?: number | null } = {},
) =>
  computeRecipe({
    servings: options.servings ?? 1,
    yieldGrams: options.yieldGrams ?? null,
    ingredients: ingredientsOf(items),
  });

describe("computeRecipe properties", () => {
  it("should total the nutrients of the ingredients, skipping a null as day totals do", () => {
    fc.assert(
      fc.property(itemsOf(maybePer100), (items) => {
        const { total } = computeFrom(items);

        for (const key of nutrientKeys) {
          expectClose(total[key], expectedTotal(items, key), key);
        }
      }),
    );
  });

  it("should give a null total for a nutrient every ingredient leaves null", () => {
    fc.assert(
      fc.property(itemsOf(maybePer100), servingsAmount, (items, servings) => {
        const unknownKcal = items.map((item) => ({
          ...item,
          per100: { ...item.per100, kcal: null },
        }));

        const computed = computeFrom(unknownKcal, { servings, yieldGrams: 500 });

        expect(computed.total.kcal).toBeNull();
        expect(computed.perServing.kcal).toBeNull();
        expect(computed.per100g.kcal).toBeNull();
      }),
    );
  });

  it("should sum the ingredients that do record a nutrient when others leave it null", () => {
    fc.assert(
      fc.property(itemsOf(maybePer100), itemsOf(knownPer100), (withNulls, known) => {
        const mixed = [...withNulls, ...known];

        const { total } = computeFrom(mixed);

        expectClose(total.kcal, expectedTotal(mixed, "kcal"), "kcal");
        expect(total.kcal).not.toBeNull();
      }),
    );
  });

  it("should give per serving times servings equal to the total", () => {
    fc.assert(
      fc.property(itemsOf(maybePer100), servingsAmount, (items, servings) => {
        const { total, perServing } = computeFrom(items, { servings });

        expectTotalFrom(total, perServing, (value) => value * servings);
      }),
    );
  });

  it("should give per 100 g times the effective grams over 100 equal to the total", () => {
    fc.assert(
      fc.property(
        itemsOf(maybePer100),
        fc.option(yieldAmount, { nil: null }),
        (items, yieldGrams) => {
          const { total, per100g, effectiveGrams } = computeFrom(items, { yieldGrams });

          expectTotalFrom(total, per100g, (value) => (value * effectiveGrams) / 100);
        },
      ),
    );
  });

  it("should let a yield change only the effective grams and the per 100 g figures", () => {
    fc.assert(
      fc.property(
        itemsOf(maybePer100),
        servingsAmount,
        yieldAmount,
        (items, servings, yieldGrams) => {
          const raw = computeFrom(items, { servings });
          const cooked = computeFrom(items, { servings, yieldGrams });

          expect(cooked.total).toEqual(raw.total);
          expect(cooked.perServing).toEqual(raw.perServing);
          expect(cooked.totalGrams).toBe(raw.totalGrams);
          expect(cooked.effectiveGrams).toBe(yieldGrams);
          expect(raw.effectiveGrams).toBe(raw.totalGrams);
        },
      ),
    );
  });

  it("should not depend on the order of the ingredients", () => {
    const shuffledItems = itemsOf(maybePer100).chain((items) =>
      fc.tuple(
        fc.constant(items),
        fc.shuffledSubarray(items, { minLength: items.length, maxLength: items.length }),
      ),
    );
    fc.assert(
      fc.property(shuffledItems, ([items, shuffled]) => {
        const original = computeFrom(items);
        const reordered = computeFrom(shuffled);

        expectNutrientsClose(reordered.total, original.total);
        expectClose(reordered.totalGrams, original.totalGrams, "totalGrams");
      }),
    );
  });

  it("should double the total when every quantity doubles", () => {
    fc.assert(
      fc.property(itemsOf(maybePer100), (items) => {
        const original = computeFrom(items);
        const doubled = computeFrom(items.map((item) => ({ ...item, grams: item.grams * 2 })));

        for (const key of nutrientKeys) {
          const base = original.total[key];
          expectClose(
            doubled.total[key],
            base === null || base === undefined ? null : base * 2,
            key,
          );
        }
        expectClose(doubled.totalGrams, original.totalGrams * 2, "totalGrams");
      }),
    );
  });

  it("should not change when an ingredient of quantity 0 is added", () => {
    fc.assert(
      fc.property(itemsOf(knownPer100), knownPer100, servingsAmount, (items, extra, servings) => {
        const before = computeFrom(items, { servings });
        const after = computeFrom([...items, { per100: extra, grams: 0 }], { servings });

        expect(after).toEqual(before);
      }),
    );
  });
});
