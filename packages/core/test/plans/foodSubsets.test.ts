import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { EVAL_FOODS, EVAL_RANKING } from "./evalKitchen";
import { RULES, weekOf } from "./pools";
import { planMeals } from "../../src/plans";
import { MAX_FOODS_PER_DAY } from "../../src/plans/buildDay";
import { fitRecipeToTargets, outOfTolerance } from "../../src/recipes";

import type { PlanFoodCandidate } from "../../src/plans";
import type { FitTarget } from "../../src/recipes";

const foodsOnly = (
  foods: readonly PlanFoodCandidate[],
  target: FitTarget,
  days = 1,
  ranking: readonly string[] = [],
) =>
  planMeals({
    recipes: [],
    foods,
    ranking,
    rules: RULES,
    days: weekOf(days, target),
  });

/** Whether some combination of these foods fits `target`, by the fitter and core's judging. */
const hasWithinSubset = (foods: readonly PlanFoodCandidate[], target: FitTarget): boolean => {
  for (let mask = 1; mask < 1 << foods.length; mask += 1) {
    const chosen = foods.filter((_, at) => (mask >> at) & 1);
    if (chosen.length > MAX_FOODS_PER_DAY) {
      continue;
    }
    const { perServing } = fitRecipeToTargets({
      servings: 1,
      target,
      ingredients: chosen.map((food) => ({
        foodId: food.id,
        per100: food.per100,
        grams: food.typicalGrams,
        locked: false,
      })),
    });
    if (outOfTolerance(perServing, target).length === 0) {
      return true;
    }
  }
  return false;
};

// Nine of the eval kitchen's foods, as the review found them: a day the planner called short although a
// smaller set of the same foods fits.
const NINE_FOODS = EVAL_FOODS.filter((food) => !["broccoli", "potato", "oil"].includes(food.id));

describe("a day that a combination of the foods fits", () => {
  it.each([
    [1771, 61],
    [1104, 150],
    [2192, 96],
  ])("should be within for %i kcal and %i g protein, not reported short", (kcal, protein_g) => {
    const [day] = foodsOnly(NINE_FOODS, { kcal, protein_g }).days;

    expect(day?.status).toBe("within");
    expect(day?.shortfalls).toEqual([]);
  });
});

describe("a day on the full eval kitchen's 12 foods", () => {
  it.each([
    [1943, 63],
    [2181, 89],
    [2199, 94],
    [1100, 146],
  ])("should be within for %i kcal and %i g protein, not reported short", (kcal, protein_g) => {
    const [day] = foodsOnly(EVAL_FOODS, { kcal, protein_g }).days;

    expect(day?.status).toBe("within");
  });

  it.each([
    ["without a ranking", [] as string[]],
    ["with the eval ranking", EVAL_RANKING],
  ])("should call a day short only when no combination fits, %s", (_, ranking) => {
    for (let kcal = 1200; kcal <= 2200; kcal += 100) {
      for (let protein_g = 60; protein_g <= 120; protein_g += 10) {
        const target = { kcal, protein_g };
        const [day] = foodsOnly(EVAL_FOODS, target, 1, ranking).days;

        if (day?.status === "short") {
          expect(hasWithinSubset(EVAL_FOODS, target)).toBe(false);
        }
      }
    }
  });
});

describe("planMeals all foods fit (oracle)", () => {
  const foodArbitrary = fc.record({
    kcal: fc.integer({ min: 20, max: 600 }),
    protein_g: fc.integer({ min: 0, max: 40 }),
    fat_g: fc.integer({ min: 0, max: 60 }),
    carbs_g: fc.integer({ min: 0, max: 90 }),
    typicalGrams: fc.integer({ min: 4, max: 60 }).map((fives) => fives * 5),
  });

  it("should call a day short only when no combination of up to 9 of the foods fits", () => {
    fc.assert(
      fc.property(
        fc
          .constantFrom(6, 9, 12)
          .chain((size) => fc.array(foodArbitrary, { minLength: size, maxLength: size })),
        fc.integer({ min: 800, max: 3000 }),
        fc.option(fc.integer({ min: 40, max: 200 }), { nil: undefined }),
        (foods, kcal, protein_g) => {
          const candidates: PlanFoodCandidate[] = foods.map((food, at) => ({
            id: `food-${at}`,
            per100: {
              kcal: food.kcal,
              protein_g: food.protein_g,
              fat_g: food.fat_g,
              carbs_g: food.carbs_g,
              fibre_g: 0,
            },
            typicalGrams: food.typicalGrams,
            bands: ["morning", "midday", "evening"],
          }));
          const target = protein_g === undefined ? { kcal } : { kcal, protein_g };

          const [day] = foodsOnly(candidates, target).days;

          if (day?.status === "short") {
            expect(hasWithinSubset(candidates, target)).toBe(false);
          }
        },
      ),
      { numRuns: 25 },
    );
  });
});
