import { describe, expect, it } from "vitest";

import { PLAN_DEFAULT_FOOD_GRAMS, PLAN_POOL_LIMITS, buildPlanPool } from "../../src/plans";
import { buildFood } from "../../src/testing";

import type { PalateFoodStat } from "../../src/palate";
import type { PlanPoolInput, PlanPoolRecipe } from "../../src/plans";

const perServing = (kcal: number | null) => ({
  kcal,
  protein_g: 20,
  fat_g: 10,
  carbs_g: 30,
  fibre_g: 4,
});

const recipe = (id: string, name: string, kcal: number | null = 500): PlanPoolRecipe => ({
  id,
  name,
  servings: 2,
  computed: { perServing: perServing(kcal) },
});

const oats = buildFood({
  id: "oats",
  name: "Oats, rolled",
  kcal: 380,
  protein_g: 11,
  fat_g: 8,
  carbs_g: 70,
  fibre_g: 8,
});
const peanuts = buildFood({ id: "peanuts", name: "Peanuts, roasted", kcal: 600 });

const stat = (
  id: { foodId?: string; recipeId?: string },
  counts: [number, number, number],
): PalateFoodStat => ({
  foodId: id.foodId ?? null,
  recipeId: id.recipeId ?? null,
  entryCount: 5,
  distinctDays: 5,
  firstLocalDate: "2026-10-01",
  lastLocalDate: "2026-11-01",
  medianResolvedGrams: 60,
  beforeElevenCount: counts[0],
  elevenToSixteenCount: counts[1],
  sixteenOrLaterCount: counts[2],
});

const input = (overrides: Partial<PlanPoolInput> = {}): PlanPoolInput => ({
  recipes: [recipe("a", "Bean chilli"), recipe("b", "Fish pie")],
  usualRecipeIds: [],
  usualFoods: [{ foodId: "oats", typicalGrams: 45 }],
  foods: [oats],
  stats: [],
  preferences: [],
  ...overrides,
});

describe("buildPlanPool", () => {
  it("should offer recipes then foods with short codes and names", () => {
    const pool = buildPlanPool(input());

    expect(pool.offers).toEqual([
      { code: "r1", id: "a", name: "Bean chilli", kind: "recipe" },
      { code: "r2", id: "b", name: "Fish pie", kind: "recipe" },
      { code: "f1", id: "oats", name: "Oats, rolled", kind: "food" },
    ]);
  });

  it("should offer the usual recipes first, in their order", () => {
    const pool = buildPlanPool(input({ usualRecipeIds: ["b"] }));

    expect(pool.recipes.map(({ id }) => id)).toEqual(["b", "a"]);
  });

  it("should take a food's amount from the diary and fall back to a default", () => {
    const withAmount = buildPlanPool(input());
    const withoutAmount = buildPlanPool(
      input({ usualFoods: [{ foodId: "oats", typicalGrams: null }] }),
    );

    expect(withAmount.foods[0]?.typicalGrams).toBe(45);
    expect(withoutAmount.foods[0]?.typicalGrams).toBe(PLAN_DEFAULT_FOOD_GRAMS);
  });

  it("should leave out a recipe with no calorie figure and a food that is not per 100 g", () => {
    const ml = buildFood({ id: "milk", name: "Milk", basis: "per_100ml", kcal: 60 });

    const pool = buildPlanPool(
      input({
        recipes: [recipe("a", "Bean chilli", null), recipe("b", "Fish pie")],
        usualFoods: [{ foodId: "milk", typicalGrams: 200 }],
        foods: [ml],
      }),
    );

    expect(pool.recipes.map(({ id }) => id)).toEqual(["b"]);
    expect(pool.foods).toEqual([]);
  });

  it("should leave out what the person avoids, by name, before anything is offered", () => {
    const pool = buildPlanPool(
      input({
        usualFoods: [
          { foodId: "oats", typicalGrams: 45 },
          { foodId: "peanuts", typicalGrams: 20 },
        ],
        foods: [oats, peanuts],
        recipes: [recipe("a", "Peanut stew"), recipe("b", "Fish pie")],
        preferences: [
          { id: "p1", kind: "allergy", foodId: null, recipeId: null, label: "peanuts" },
        ],
      }),
    );

    expect(pool.offers.map(({ id }) => id)).toEqual(["b", "oats"]);
  });

  it("should give an item the bands the diary shows it eaten in, and all three when it says nothing", () => {
    const pool = buildPlanPool(input({ stats: [stat({ foodId: "oats" }, [4, 0, 1])] }));

    expect(pool.foods[0]?.bands).toEqual(["morning", "evening"]);
    expect(pool.recipes[0]?.bands).toEqual(["morning", "midday", "evening"]);
  });

  it("should cap what is offered", () => {
    const many = Array.from({ length: PLAN_POOL_LIMITS.recipes + 5 }, (_, at) =>
      recipe(`r${at}`, `Recipe ${at}`),
    );

    expect(buildPlanPool(input({ recipes: many })).recipes).toHaveLength(PLAN_POOL_LIMITS.recipes);
  });

  it("should pin the caps", () => {
    expect(PLAN_POOL_LIMITS).toEqual({ recipes: 30, foods: 20 });
    expect(PLAN_DEFAULT_FOOD_GRAMS).toBe(100);
  });
});
