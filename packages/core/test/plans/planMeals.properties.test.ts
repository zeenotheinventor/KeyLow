import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { sumNutrients } from "../../src/nutrition";
import { planMeals, replanDay } from "../../src/plans";
import { isWithinTolerance, outOfTolerance } from "../../src/recipes";

import type {
  Plan,
  PlanBand,
  PlanFoodCandidate,
  PlanMealsInput,
  PlanPool,
  PlanRecipeCandidate,
} from "../../src/plans";

const BANDS: readonly PlanBand[] = ["morning", "midday", "evening"];
const NUMBER_OF_RUNS = 60;

const bandsArbitrary = fc.subarray([...BANDS], { minLength: 1 });

const foodArbitrary = fc.record({
  kcal: fc.integer({ min: 20, max: 600 }),
  protein_g: fc.integer({ min: 0, max: 40 }),
  fat_g: fc.integer({ min: 0, max: 60 }),
  carbs_g: fc.integer({ min: 0, max: 90 }),
  typicalGrams: fc.integer({ min: 4, max: 60 }).map((fives) => fives * 5),
  bands: bandsArbitrary,
});

const recipeArbitrary = fc.record({
  kcal: fc.integer({ min: 100, max: 900 }),
  protein_g: fc.integer({ min: 0, max: 60 }),
  servings: fc.integer({ min: 1, max: 5 }),
  bands: bandsArbitrary,
});

const poolArbitrary: fc.Arbitrary<PlanPool> = fc
  .record({
    foods: fc.array(foodArbitrary, { minLength: 0, maxLength: 10 }),
    recipes: fc.array(recipeArbitrary, { minLength: 0, maxLength: 5 }),
    maxRepeats: fc.option(fc.integer({ min: 1, max: 7 }), { nil: null }),
    leftovers: fc.boolean(),
    slots: bandsArbitrary,
  })
  .map(({ foods, recipes, maxRepeats, leftovers, slots }) => {
    const foodCandidates: PlanFoodCandidate[] = foods.map((food, at) => ({
      id: `food-${at}`,
      per100: {
        kcal: food.kcal,
        protein_g: food.protein_g,
        fat_g: food.fat_g,
        carbs_g: food.carbs_g,
        fibre_g: 0,
      },
      typicalGrams: food.typicalGrams,
      bands: food.bands,
    }));
    const recipeCandidates: PlanRecipeCandidate[] = recipes.map((recipe, at) => ({
      id: `recipe-${at}`,
      perServing: {
        kcal: recipe.kcal,
        protein_g: recipe.protein_g,
        fat_g: 10,
        carbs_g: 30,
        fibre_g: 0,
      },
      servings: recipe.servings,
      bands: recipe.bands,
    }));
    return {
      foods: foodCandidates,
      recipes: recipeCandidates,
      ranking: [...recipeCandidates, ...foodCandidates].map(({ id }) => id).reverse(),
      rules: { maxRepeats, leftovers, slots },
    };
  });

const daysArbitrary = fc
  .array(
    fc.record({
      kcal: fc.integer({ min: 800, max: 3000 }),
      protein_g: fc.option(fc.integer({ min: 40, max: 200 }), { nil: undefined }),
    }),
    { minLength: 1, maxLength: 7 },
  )
  .map((targets) =>
    targets.map(({ kcal, protein_g }, index) => ({
      localDate: `2026-11-${String(16 + index).padStart(2, "0")}`,
      target: protein_g === undefined ? { kcal } : { kcal, protein_g },
    })),
  );

const inputArbitrary: fc.Arbitrary<PlanMealsInput> = fc
  .tuple(poolArbitrary, daysArbitrary)
  .map(([pool, days]) => ({ ...pool, days }));

const recipeItemsOf = (plan: Plan) =>
  plan.days.flatMap((day) =>
    day.items.flatMap((item) =>
      item.kind === "recipe" ? [{ item, localDate: day.localDate }] : [],
    ),
  );

const countsOf = (plan: Plan): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const { item } of recipeItemsOf(plan)) {
    counts.set(item.recipeId, (counts.get(item.recipeId) ?? 0) + 1);
  }
  return counts;
};

/**
 * `isUnbroken` also asks that a cook's leftovers sit on the days straight after it. A replanned day can break
 * that, because it drops the leftover that sat on it and leaves the later ones.
 */
const expectLeftoversConsistent = (plan: Plan, pool: PlanPool, isUnbroken: boolean): void => {
  const placements = recipeItemsOf(plan);
  const servingsOf = new Map(pool.recipes.map((recipe) => [recipe.id, recipe.servings]));
  const dates = plan.days.map((day) => day.localDate);

  for (const { item, localDate } of placements) {
    if (item.leftoverOf === null) {
      const leftovers = placements.filter(({ item: other }) => other.leftoverOf === item.key);
      expect(leftovers.length).toBeLessThanOrEqual(
        Math.max(0, Math.floor(servingsOf.get(item.recipeId) ?? 1) - 1),
      );
      if (isUnbroken) {
        expect(leftovers.map(({ localDate: date }) => date).sort()).toEqual(
          dates.slice(
            dates.indexOf(localDate) + 1,
            dates.indexOf(localDate) + 1 + leftovers.length,
          ),
        );
      }
    } else {
      const cook = placements.find(({ item: other }) => other.key === item.leftoverOf);
      expect(cook?.item.leftoverOf).toBeNull();
      expect(cook?.item.recipeId).toBe(item.recipeId);
      expect(cook?.item.band).toBe(item.band);
      expect(cook !== undefined && cook.localDate < localDate).toBe(true);
    }
  }
};

describe("planMeals properties", () => {
  it("should call a day within only when core's own sums are within tolerance, and name every miss otherwise", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        for (const day of planMeals(input).days) {
          expect(day.totals).toEqual(sumNutrients(day.items.map((item) => item.nutrients)));
          expect(day.status === "within").toBe(isWithinTolerance(day.totals, day.target));
          expect(
            day.shortfalls.map(({ nutrient, target, achieved }) => ({
              nutrient,
              target,
              achieved,
            })),
          ).toEqual(outOfTolerance(day.totals, day.target));
          expect(day.shortfalls.every(({ reason }) => reason.length > 0)).toBe(true);
        }
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });

  it("should never place a recipe more often than the limit, leftovers included", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const limit = input.rules.maxRepeats;
        for (const count of countsOf(planMeals(input)).values()) {
          expect(count).toBeLessThanOrEqual(limit ?? Number.POSITIVE_INFINITY);
        }
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });

  it("should keep leftovers consistent with the servings a recipe makes", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const plan = planMeals(input);
        expectLeftoversConsistent(plan, input, true);
        if (!input.rules.leftovers) {
          expect(recipeItemsOf(plan).every(({ item }) => item.leftoverOf === null)).toBe(true);
        }
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });

  it("should place each recipe and each food at most once a day, in a band that was asked for", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        for (const day of planMeals(input).days) {
          const ids = day.items.map((item) =>
            item.kind === "recipe" ? item.recipeId : item.foodId,
          );
          expect(new Set(ids).size).toBe(ids.length);
          expect(day.items.every((item) => input.rules.slots.includes(item.band))).toBe(true);
        }
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });

  it("should move a food only between 5 g and double its usual amount", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        const typical = new Map(input.foods.map((food) => [food.id, food.typicalGrams]));
        for (const item of planMeals(input).days.flatMap((day) => day.items)) {
          if (item.kind === "food") {
            const usual = typical.get(item.foodId) ?? 0;
            // Half the usual amount, or down to 5 g when the day needed the all foods fit.
            expect(item.grams).toBeGreaterThanOrEqual(Math.min(usual, 5) - 1e-9);
            expect(item.grams).toBeLessThanOrEqual(Math.max(usual, usual * 2) + 1e-9);
          }
        }
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });

  it("should give the same plan for the same input", () => {
    fc.assert(
      fc.property(inputArbitrary, (input) => {
        expect(planMeals(input)).toEqual(planMeals(structuredClone(input)));
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });
});

describe("replanDay properties", () => {
  const replanArbitrary = fc.tuple(inputArbitrary, fc.nat());

  it("should leave every other day identical and keep the limit across the whole plan", () => {
    fc.assert(
      fc.property(replanArbitrary, ([input, pick]) => {
        const plan = planMeals(input);
        const at = pick % plan.days.length;
        const replaced = plan.days[at]?.localDate ?? "";

        const replanned = replanDay(plan, replaced, input).plan;

        expect(replanned.days).toHaveLength(plan.days.length);
        plan.days.forEach((day, index) => {
          expect(replanned.days[index]).toEqual(index === at ? replanned.days[at] : day);
          if (index !== at) {
            expect(replanned.days[index]).toBe(day);
          }
        });
        for (const count of countsOf(replanned).values()) {
          expect(count).toBeLessThanOrEqual(input.rules.maxRepeats ?? Number.POSITIVE_INFINITY);
        }
        expectLeftoversConsistent(replanned, input, false);
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });

  it("should judge the replaced day by core's sums against its own target", () => {
    fc.assert(
      fc.property(replanArbitrary, ([input, pick]) => {
        const plan = planMeals(input);
        const at = pick % plan.days.length;
        const day = replanDay(plan, plan.days[at]?.localDate ?? "", input).plan.days[at];

        expect(day?.target).toEqual(plan.days[at]?.target);
        expect(day?.status === "within").toBe(
          day !== undefined && isWithinTolerance(day.totals, day.target),
        );
      }),
      { numRuns: NUMBER_OF_RUNS },
    );
  });
});

describe("planMeals with no limit", () => {
  it("should allow a recipe more often than the starting limit of 2", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 3 }), (servings) => {
        const recipe: PlanRecipeCandidate = {
          id: "bowl",
          perServing: { kcal: 500, protein_g: 30, fat_g: 10, carbs_g: 50, fibre_g: 0 },
          servings,
          bands: ["evening"],
        };
        const days = Array.from({ length: 7 }, (_, index) => ({
          localDate: `2026-11-${String(16 + index).padStart(2, "0")}`,
          target: { kcal: 1300 },
        }));
        const plan = planMeals({
          recipes: [recipe],
          foods: [],
          ranking: ["bowl"],
          rules: { maxRepeats: null, leftovers: true, slots: ["evening"] },
          days,
        });

        expect(countsOf(plan).get("bowl")).toBe(7);
      }),
    );
  });
});
