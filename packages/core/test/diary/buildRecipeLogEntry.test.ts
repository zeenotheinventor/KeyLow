import { describe, expect, it } from "vitest";

import {
  NUTRITION_ENGINE_VERSION,
  SNAPSHOT_VERSION,
  buildRecipeLogEntry,
  recipeLogEntryInsertSchema,
} from "../../src/diary";
import { computeRecipe } from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { BuildRecipeLogEntryInput, LoggableRecipe } from "../../src/diary";

const when = { loggedAt: "2026-10-17T12:30:00+01:00", localDate: "2026-10-17" } as const;

const recipeId = "00000000-0000-4000-8000-0000000000b1";

/** The chicken, rice and oil recipe as the library holds it: its row and the cache saved with it. */
const chickenAndRice = (
  overrides: Parameters<typeof buildChickenAndRiceRecipe>[0] = {},
): LoggableRecipe => {
  const { servings, yieldGrams, ingredients } = buildChickenAndRiceRecipe(overrides);
  return {
    id: recipeId,
    name: "Chicken and rice",
    servings,
    yield_grams: yieldGrams,
    computed: computeRecipe({ servings, yieldGrams, ingredients }),
  };
};

const build = (input: Partial<BuildRecipeLogEntryInput> = {}) =>
  buildRecipeLogEntry({
    recipe: chickenAndRice({ servings: 4, yieldGrams: 1100 }),
    quantity: 1,
    unit: "serving",
    ...when,
    ...input,
  });

describe("buildRecipeLogEntry", () => {
  describe("the chicken and rice golden", () => {
    it("should log one serving of four as 374.2 kcal", () => {
      const entry = build({ quantity: 1, unit: "serving" });

      expect(entry.nutrients.kcal).toBeCloseTo(374.2, 9);
      expect(entry.nutrients.protein_g).toBeCloseTo(31.625, 9);
    });

    it("should log one serving as a quarter of the 1100 g yield", () => {
      expect(build({ quantity: 1, unit: "serving" }).resolved_grams).toBe(275);
    });

    it("should log 275 g of the cooked weight as 374.2 kcal", () => {
      const entry = build({ quantity: 275, unit: "g" });

      expect(entry.nutrients.kcal).toBeCloseTo(136.0727272727 * 2.75, 6);
      expect(entry.nutrients.kcal).toBeCloseTo(374.2, 9);
      expect(entry.resolved_grams).toBe(275);
    });

    it("should log 275 g of a recipe with no yield as 571.694 kcal", () => {
      const entry = build({ recipe: chickenAndRice({ servings: 4 }), quantity: 275, unit: "g" });

      expect(entry.nutrients.kcal).toBeCloseTo(571.694, 3);
      expect(entry.nutrients.kcal).toBeCloseTo((1496.8 * 275) / 720, 9);
      expect(entry.snapshot.effectiveGrams).toBe(720);
    });

    it("should log one serving of a recipe with no yield from its raw weight", () => {
      const entry = build({
        recipe: chickenAndRice({ servings: 4 }),
        quantity: 1,
        unit: "serving",
      });

      expect(entry.resolved_grams).toBe(180);
      expect(entry.nutrients.kcal).toBeCloseTo(374.2, 9);
    });

    it("should log one and a half servings", () => {
      const entry = build({ quantity: 1.5, unit: "serving" });

      expect(entry.nutrients.kcal).toBeCloseTo(561.3, 9);
      expect(entry.resolved_grams).toBe(412.5);
    });
  });

  describe("the evaluation order", () => {
    it("should scale by serving as (total x quantity) / servings", () => {
      const recipe = chickenAndRice({ servings: 3, yieldGrams: 1034.7 });
      const { total } = recipe.computed;

      const entry = build({ recipe, quantity: 1.7, unit: "serving" });

      expect(entry.nutrients.kcal).toBe(((total.kcal ?? Number.NaN) * 1.7) / 3);
      expect(entry.resolved_grams).toBe((1.7 * 1034.7) / 3);
    });

    it("should scale by grams as (total x grams) / effective grams", () => {
      const recipe = chickenAndRice({ servings: 3, yieldGrams: 1034.7 });
      const { total } = recipe.computed;

      const entry = build({ recipe, quantity: 213.3, unit: "g" });

      expect(entry.nutrients.protein_g).toBe(((total.protein_g ?? Number.NaN) * 213.3) / 1034.7);
    });
  });

  describe("the entry", () => {
    it("should be a row the recipe entry schema accepts", () => {
      const entry = build();

      expect(recipeLogEntryInsertSchema.parse(entry)).toEqual(entry);
    });

    it("should name the recipe and have no food and no portion", () => {
      const entry = build();

      expect(entry).toMatchObject({
        item_type: "recipe",
        recipe_id: recipeId,
        food_id: null,
        portion_id: null,
        quantity: 1,
        unit: "serving",
      });
    });

    it("should store the time and the day as given", () => {
      expect(build()).toMatchObject({
        logged_at: "2026-10-17T12:30:00+01:00",
        local_date: "2026-10-17",
      });
    });

    it("should freeze the recipe's name, servings, yield, cooked weight and totals", () => {
      const recipe = chickenAndRice({ servings: 4, yieldGrams: 1100 });

      const { snapshot } = build({ recipe, quantity: 2, unit: "serving" });

      expect(snapshot).toEqual({
        v: SNAPSHOT_VERSION,
        kind: "recipe",
        ref: recipeId,
        name: "Chicken and rice",
        servings: 4,
        yieldGrams: 1100,
        effectiveGrams: 1100,
        total: recipe.computed.total,
        quantity: 2,
        unit: "serving",
        resolvedGrams: 550,
        engineVersion: NUTRITION_ENGINE_VERSION,
      });
    });

    it("should freeze a missing yield as null", () => {
      expect(build({ recipe: chickenAndRice({ servings: 4 }) }).snapshot.yieldGrams).toBeNull();
    });

    it("should not carry the ingredients, the per serving figures or the per 100 g figures", () => {
      const keys = Object.keys(build().snapshot).sort();

      expect(keys).toEqual(
        [
          "effectiveGrams",
          "engineVersion",
          "kind",
          "name",
          "quantity",
          "ref",
          "resolvedGrams",
          "servings",
          "total",
          "unit",
          "v",
          "yieldGrams",
        ].sort(),
      );
    });

    it("should carry the five required keys, and no optional key the totals lack", () => {
      expect(Object.keys(build().nutrients).sort()).toEqual(
        ["carbs_g", "fat_g", "fibre_g", "kcal", "protein_g"].sort(),
      );
    });

    it("should carry saturated fat, sugars and salt when the totals have them, and unknown stays null", () => {
      const recipe: LoggableRecipe = {
        ...chickenAndRice(),
        computed: {
          ...chickenAndRice().computed,
          total: {
            kcal: 800,
            protein_g: null,
            fat_g: 20,
            carbs_g: 100,
            fibre_g: 8,
            sat_fat_g: 6,
            sugars_g: 12,
            salt_g: 3,
          },
        },
      };

      const { nutrients } = build({ recipe, quantity: 1, unit: "serving" });

      expect(nutrients).toEqual({
        kcal: 200,
        protein_g: null,
        fat_g: 5,
        carbs_g: 25,
        fibre_g: 2,
        sat_fat_g: 1.5,
        sugars_g: 3,
        salt_g: 0.75,
      });
    });

    it("should log nothing for a quantity of 0", () => {
      const entry = build({ quantity: 0, unit: "serving" });

      expect(entry.nutrients.kcal).toBe(0);
      expect(entry.resolved_grams).toBe(0);
    });
  });

  describe("invalid input", () => {
    it("should throw a RangeError for a negative quantity", () => {
      expect(() => build({ quantity: -1 })).toThrow(RangeError);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY])(
      "should throw a RangeError for a quantity of %s",
      (quantity) => {
        expect(() => build({ quantity })).toThrow(RangeError);
      },
    );

    it("should throw a RangeError for a recipe with no servings", () => {
      expect(() => build({ recipe: { ...chickenAndRice(), servings: 0 } })).toThrow(RangeError);
    });

    it("should throw a RangeError for a recipe that weighs nothing", () => {
      const recipe = chickenAndRice();

      expect(() =>
        build({ recipe: { ...recipe, computed: { ...recipe.computed, effectiveGrams: 0 } } }),
      ).toThrow(RangeError);
    });

    it("should throw a RangeError for an amount too large to work out", () => {
      expect(() => build({ quantity: Number.MAX_VALUE, unit: "serving" })).toThrow(RangeError);
    });

    it("should throw a RangeError for a unit that is not serving or g", () => {
      // @ts-expect-error The type refuses a unit core does not log a recipe in, a caller in JavaScript could not be stopped.
      expect(() => build({ unit: "ml" })).toThrow(RangeError);
    });

    it("should not quote the quantity, the servings, the weight or the name in a message", () => {
      const recipe = chickenAndRice();
      const attempts = [
        () => build({ quantity: -7.77 }),
        () => build({ recipe: { ...recipe, servings: 0, name: "Secret stew" } }),
        () =>
          build({
            recipe: { ...recipe, computed: { ...recipe.computed, effectiveGrams: 0 } },
            quantity: 3.33,
          }),
        () => build({ quantity: Number.MAX_VALUE }),
        // @ts-expect-error See above.
        () => build({ unit: "pinch" }),
      ];

      for (const attempt of attempts) {
        expect(attempt).toThrow(RangeError);
        try {
          attempt();
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          expect(message).not.toMatch(/7\.77|3\.33|Secret|1\.79|pinch/);
        }
      }
    });
  });
});
