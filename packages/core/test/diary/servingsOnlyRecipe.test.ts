import { describe, expect, it } from "vitest";

import {
  buildRecipeLogEntry,
  canLogRecipe,
  previewRecipeAmount,
  previewTypedRecipeAmount,
  recipeLogEntryInsertSchema,
  recipeSnapshotSchema,
  recipeUnitsOf,
  recomputeRecipeEntry,
} from "../../src/diary";
import { freezeRecipe, withRecipeQuantity } from "../../src/diary/recipeSnapshotQuantity";
import { computeRecipe, recipeOfSnapshot } from "../../src/recipes";
import { buildBucketAndFriesRecipe, buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary";

const recipeId = "00000000-0000-4000-8000-0000000000b1";
const when = { loggedAt: "2026-10-17T12:30:00+01:00", localDate: "2026-10-17" } as const;

/** The meal deal as the library holds it: its row and the cache saved with it. */
const mealDeal = (): LoggableRecipe & { computed: ReturnType<typeof computeRecipe> } => {
  const { servings, yieldGrams, ingredients } = buildBucketAndFriesRecipe({ servings: 4 });
  return {
    id: recipeId,
    name: "Meal deal",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

describe("a recipe with a food per portion, logged (ADR 0003, Amendment 19)", () => {
  const total = mealDeal().computed.total;

  describe("by servings", () => {
    const entry = buildRecipeLogEntry({
      recipe: mealDeal(),
      quantity: 0.5,
      unit: "serving",
      ...when,
    });

    it("should log an eighth of the total for half a serving of four", () => {
      expect(entry.nutrients.kcal).toBeCloseTo((total.kcal ?? Number.NaN) / 8, 9);
    });

    it("should have no grams", () => {
      expect(entry.resolved_grams).toBe(0);
      expect(entry.snapshot).toMatchObject({ effectiveGrams: 0, servingsOnly: true });
    });

    it("should be an entry the schema accepts", () => {
      expect(recipeLogEntryInsertSchema.safeParse(entry).success).toBe(true);
    });

    it("should recompute from the snapshot alone when edited to 1 serving", () => {
      const edited = recomputeRecipeEntry(entry, { quantity: 1, unit: "serving" });

      expect(edited.nutrients.kcal).toBeCloseTo((total.kcal ?? Number.NaN) / 4, 9);
      expect(edited.resolved_grams).toBe(0);
    });

    it("should be offered for logging", () => {
      expect(canLogRecipe(mealDeal())).toBe(true);
    });
  });

  describe("the units offered", () => {
    it("should be servings alone", () => {
      expect(recipeUnitsOf(mealDeal())).toEqual(["serving"]);
    });

    it("should be servings and grams for a recipe of weighed foods", () => {
      const { servings, yieldGrams, ingredients } = buildChickenAndRiceRecipe();

      expect(
        recipeUnitsOf({
          id: recipeId,
          name: "Chicken and rice",
          servings,
          yield_grams: yieldGrams,
          computed: computeRecipe({ servings, yieldGrams, ingredients }),
        }),
      ).toEqual(["serving", "g"]);
    });
  });

  describe("by grams", () => {
    it("should throw, because there is no weight to measure it against", () => {
      expect(() =>
        buildRecipeLogEntry({ recipe: mealDeal(), quantity: 100, unit: "g", ...when }),
      ).toThrow(RangeError);
    });

    it("should throw when an entry is edited to grams", () => {
      const entry = buildRecipeLogEntry({
        recipe: mealDeal(),
        quantity: 1,
        unit: "serving",
        ...when,
      });

      expect(() => recomputeRecipeEntry(entry, { quantity: 100, unit: "g" })).toThrow(RangeError);
    });

    it("should preview nothing", () => {
      expect(previewRecipeAmount(mealDeal(), { quantity: 100, unit: "g" })).toBeNull();
      expect(previewTypedRecipeAmount(mealDeal(), "g", "100")).toBeNull();
    });
  });

  describe("the snapshot", () => {
    const snapshot = buildRecipeLogEntry({
      recipe: mealDeal(),
      quantity: 1,
      unit: "serving",
      ...when,
    }).snapshot;

    it("should refuse a cooked weight of 0 without servings only", () => {
      const without = Object.fromEntries(
        Object.entries(snapshot).filter(([key]) => key !== "servingsOnly"),
      );

      expect(recipeSnapshotSchema.safeParse(without).success).toBe(false);
    });

    it("should refuse grams for a recipe with servings only", () => {
      expect(recipeSnapshotSchema.safeParse({ ...snapshot, unit: "g" }).success).toBe(false);
    });

    it("should say what is wrong when a recipe that is servings only has a weight", () => {
      expect(() =>
        withRecipeQuantity(
          { ...freezeRecipe(mealDeal()), effectiveGrams: 500 },
          { quantity: 1, unit: "serving" },
        ),
      ).toThrow(new RangeError("A recipe that is servings only must have a weight of 0"));
    });

    it("should give a recipe made from it no values per 100 g", () => {
      expect(recipeOfSnapshot(snapshot).computed.per100g.kcal).toBeNull();
    });
  });

  it("should leave a recipe snapshot from before servings only unchanged", () => {
    const old = {
      v: 1,
      kind: "recipe",
      ref: recipeId,
      name: "Chicken and rice",
      servings: 4,
      yieldGrams: 1100,
      effectiveGrams: 1100,
      total: { kcal: 1496.8, protein_g: 126.5, fat_g: 22, carbs_g: 156, fibre_g: 4 },
      quantity: 1,
      unit: "serving",
      resolvedGrams: 275,
      engineVersion: 1,
    };

    expect(recipeSnapshotSchema.parse(old)).toEqual(old);
  });
});
