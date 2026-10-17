import { describe, expect, it } from "vitest";

import {
  buildRecipeLogEntry,
  recipeLogEntryInsertSchema,
  recomputeRecipeEntry,
} from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { LoggableRecipe, RecipeLogEntryInsert } from "../../src/diary";

const recipeId = "00000000-0000-4000-8000-0000000000b1";

const recipe = (): LoggableRecipe => {
  const { servings, yieldGrams, ingredients } = buildChickenAndRiceRecipe({
    servings: 4,
    yieldGrams: 1100,
  });
  return {
    id: recipeId,
    name: "Chicken and rice",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

const logged = (): RecipeLogEntryInsert =>
  buildRecipeLogEntry({
    recipe: recipe(),
    quantity: 1,
    unit: "serving",
    loggedAt: "2026-10-17T12:30:00+01:00",
    localDate: "2026-10-17",
  });

describe("recomputeRecipeEntry", () => {
  it("should change the number of servings", () => {
    const entry = recomputeRecipeEntry(logged(), { quantity: 2, unit: "serving" });

    expect(entry.nutrients.kcal).toBeCloseTo(748.4, 9);
    expect(entry.resolved_grams).toBe(550);
    expect(entry.quantity).toBe(2);
  });

  it("should change from servings to grams of cooked weight", () => {
    const entry = recomputeRecipeEntry(logged(), { quantity: 275, unit: "g" });

    expect(entry.unit).toBe("g");
    expect(entry.snapshot.unit).toBe("g");
    expect(entry.resolved_grams).toBe(275);
    expect(entry.nutrients.kcal).toBeCloseTo(374.2, 9);
  });

  it("should change from grams back to servings", () => {
    const grams = recomputeRecipeEntry(logged(), { quantity: 550, unit: "g" });

    const entry = recomputeRecipeEntry(grams, { quantity: 1.5, unit: "serving" });

    expect(entry.unit).toBe("serving");
    expect(entry.resolved_grams).toBe(412.5);
    expect(entry.nutrients.kcal).toBeCloseTo(561.3, 9);
  });

  it("should give the same entry as building it with that amount", () => {
    const built = buildRecipeLogEntry({
      recipe: recipe(),
      quantity: 321.5,
      unit: "g",
      loggedAt: "2026-10-17T12:30:00+01:00",
      localDate: "2026-10-17",
    });

    expect(recomputeRecipeEntry(logged(), { quantity: 321.5, unit: "g" })).toEqual(built);
  });

  it("should keep the frozen name, servings, yield, cooked weight and totals", () => {
    const before = logged();

    const { snapshot } = recomputeRecipeEntry(before, { quantity: 3, unit: "serving" });

    expect(snapshot).toMatchObject({
      ref: recipeId,
      name: "Chicken and rice",
      servings: 4,
      yieldGrams: 1100,
      effectiveGrams: 1100,
      total: before.snapshot.total,
    });
  });

  it("should keep everything else on the entry", () => {
    const entry = { ...logged(), id: "00000000-0000-4000-8000-0000000000c1" };

    const recomputed = recomputeRecipeEntry(entry, { quantity: 2, unit: "serving" });

    expect(recomputed).toMatchObject({
      id: "00000000-0000-4000-8000-0000000000c1",
      logged_at: "2026-10-17T12:30:00+01:00",
      local_date: "2026-10-17",
      recipe_id: recipeId,
      food_id: null,
      portion_id: null,
    });
  });

  it("should give a row the recipe entry schema accepts", () => {
    const entry = recomputeRecipeEntry(logged(), { quantity: 2.5, unit: "serving" });

    expect(recipeLogEntryInsertSchema.parse(entry)).toEqual(entry);
  });

  it("should not take the recipe: it works from the entry's own snapshot", () => {
    expect(recomputeRecipeEntry).toHaveLength(2);
  });

  it("should use the servings and cooked weight frozen in the snapshot", () => {
    const entry = logged();
    const edited = { ...entry, snapshot: { ...entry.snapshot, servings: 2, effectiveGrams: 600 } };

    const recomputed = recomputeRecipeEntry(edited, { quantity: 1, unit: "serving" });

    expect(recomputed.resolved_grams).toBe(300);
    expect(recomputed.nutrients.kcal).toBeCloseTo(748.4, 9);
  });

  describe("invalid input", () => {
    it("should throw a RangeError for a negative quantity", () => {
      expect(() => recomputeRecipeEntry(logged(), { quantity: -1, unit: "g" })).toThrow(RangeError);
    });

    it("should throw a RangeError for a serving count when the snapshot has 0 servings", () => {
      const entry = logged();
      const broken = { ...entry, snapshot: { ...entry.snapshot, servings: 0 } };

      expect(() => recomputeRecipeEntry(broken, { quantity: 1, unit: "serving" })).toThrow(
        RangeError,
      );
    });

    it("should throw a RangeError for a snapshot with no cooked weight", () => {
      const entry = logged();
      const broken = { ...entry, snapshot: { ...entry.snapshot, effectiveGrams: 0 } };

      expect(() => recomputeRecipeEntry(broken, { quantity: 10, unit: "g" })).toThrow(RangeError);
    });

    it("should throw a RangeError for an unknown unit", () => {
      // @ts-expect-error The type refuses a unit core does not log a recipe in, a caller in JavaScript could not be stopped.
      expect(() => recomputeRecipeEntry(logged(), { quantity: 1, unit: "portion" })).toThrow(
        RangeError,
      );
    });

    it("should not quote the quantity or the servings in a message", () => {
      const entry = logged();
      const attempts = [
        () => recomputeRecipeEntry(entry, { quantity: -4.56, unit: "g" }),
        () =>
          recomputeRecipeEntry(
            { ...entry, snapshot: { ...entry.snapshot, servings: 0 } },
            { quantity: 7.89, unit: "serving" },
          ),
      ];

      for (const attempt of attempts) {
        expect(attempt).toThrow(RangeError);
        try {
          attempt();
        } catch (error) {
          expect(error instanceof Error ? error.message : "").not.toMatch(/4\.56|7\.89/);
        }
      }
    });
  });
});
