import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { RULES, weekOf } from "./pools";
import { planMeals } from "../../src/plans";
import { fitRecipeToTargets, outOfTolerance } from "../../src/recipes";

import type { PlanBand, PlanFoodCandidate, PlanRecipeCandidate } from "../../src/plans";
import type { FitIngredient, FitTarget } from "../../src/recipes";

const BANDS: readonly PlanBand[] = ["morning", "midday", "evening"];

const nutrients = (kcal: number, protein_g: number) => ({
  kcal,
  protein_g,
  fat_g: 5,
  carbs_g: 20,
  fibre_g: 0,
});

/** Every way to give each band no recipe or a recipe that suits it, each recipe at most once. */
const recipeChoices = (recipes: readonly PlanRecipeCandidate[]): PlanRecipeCandidate[][] => {
  const choices: PlanRecipeCandidate[][] = [];
  const walk = (at: number, chosen: PlanRecipeCandidate[]): void => {
    const band = BANDS[at];
    if (band === undefined) {
      choices.push(chosen);
      return;
    }
    walk(at + 1, chosen);
    for (const recipe of recipes) {
      if (recipe.bands.includes(band) && !chosen.includes(recipe)) {
        walk(at + 1, [...chosen, recipe]);
      }
    }
  };
  walk(0, []);
  return choices;
};

/** Whether some allowed recipes plus some foods fit `target`, by the fitter and core's judging. */
const hasWithinCombination = (
  recipes: readonly PlanRecipeCandidate[],
  foods: readonly PlanFoodCandidate[],
  target: FitTarget,
): boolean => {
  for (const chosen of recipeChoices(recipes)) {
    const locked: FitIngredient[] = chosen.map((recipe) => ({
      foodId: recipe.id,
      per100: recipe.perServing,
      grams: 100,
      locked: true,
    }));
    for (let mask = 0; mask < 1 << foods.length; mask += 1) {
      const picked = foods.filter((_, at) => (mask >> at) & 1);
      const ingredients = [
        ...locked,
        ...picked.map((food) => ({
          foodId: food.id,
          per100: food.per100,
          grams: food.typicalGrams,
          locked: false,
        })),
      ];
      if (ingredients.length === 0) {
        continue;
      }
      const { perServing } = fitRecipeToTargets({ ingredients, servings: 1, target });
      if (outOfTolerance(perServing, target).length === 0) {
        return true;
      }
    }
  }
  return false;
};

describe("planMeals recipe choices (oracle)", () => {
  const recipeArbitrary = fc.record({
    kcal: fc.integer({ min: 100, max: 900 }),
    protein_g: fc.integer({ min: 0, max: 70 }),
    bands: fc.subarray([...BANDS], { minLength: 1 }),
  });
  const foodArbitrary = fc.record({
    kcal: fc.integer({ min: 20, max: 600 }),
    protein_g: fc.integer({ min: 0, max: 40 }),
    typicalGrams: fc.integer({ min: 4, max: 60 }).map((fives) => fives * 5),
  });

  it("should call a day short only when no allowed recipes and foods fit", () => {
    fc.assert(
      fc.property(
        fc.array(recipeArbitrary, { minLength: 1, maxLength: 3 }),
        fc.array(foodArbitrary, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 900, max: 2600 }),
        fc.integer({ min: 40, max: 180 }),
        (recipeSeeds, foodSeeds, kcal, protein_g) => {
          const recipes: PlanRecipeCandidate[] = recipeSeeds.map((seed, at) => ({
            id: `recipe-${at}`,
            perServing: nutrients(seed.kcal, seed.protein_g),
            servings: 1,
            bands: seed.bands,
          }));
          const foods: PlanFoodCandidate[] = foodSeeds.map((seed, at) => ({
            id: `food-${at}`,
            per100: nutrients(seed.kcal, seed.protein_g),
            typicalGrams: seed.typicalGrams,
            bands: [...BANDS],
          }));
          const target = { kcal, protein_g };

          const [day] = planMeals({
            recipes,
            foods,
            ranking: [],
            rules: { ...RULES, maxRepeats: null, leftovers: false },
            days: weekOf(1, target),
          }).days;

          if (day?.status === "short") {
            expect(day.shortfalls.some(({ reason }) => reason === "work_limit")).toBe(false);
            expect(hasWithinCombination(recipes, foods, target)).toBe(false);
          }
        },
      ),
      { numRuns: 40, seed: 20261113 },
    );
  });
});

describe("planMeals swaps a recipe for another when the first cannot fit", () => {
  // One food that adds only calories (up to 200 kcal, no protein), and two recipes for the morning. The target is
  // 1,000 kcal and 50 g protein. The preferred recipe has 100 g of protein, so with it the day is out whatever the
  // food does. With no recipe the food reaches only 200 kcal. Only the second recipe, with the food, fits, so no
  // drop of a recipe can fix the day and a swap must.
  const calories = {
    id: "calories",
    per100: nutrients(100, 0),
    typicalGrams: 100,
    bands: ["morning"] as PlanBand[],
  };
  const heavyProtein = {
    id: "heavy-protein",
    perServing: nutrients(900, 100),
    servings: 1,
    bands: ["morning"] as PlanBand[],
  };
  const balanced = {
    id: "balanced",
    perServing: nutrients(800, 50),
    servings: 1,
    bands: ["morning"] as PlanBand[],
  };

  it("should be within with the second recipe, which no drop could reach", () => {
    const [day] = planMeals({
      recipes: [heavyProtein, balanced],
      foods: [calories],
      ranking: ["heavy-protein", "balanced", "calories"],
      rules: { ...RULES, maxRepeats: null, leftovers: false, slots: ["morning"] },
      days: weekOf(1, { kcal: 1000, protein_g: 50 }),
    }).days;

    expect(day?.status).toBe("within");
    expect(
      day?.items.map((item) => (item.kind === "recipe" ? item.recipeId : item.foodId)).sort(),
    ).toEqual(["balanced", "calories"]);
  });

  it("should leave the day short when the second recipe is not offered", () => {
    const [day] = planMeals({
      recipes: [heavyProtein],
      foods: [calories],
      ranking: [],
      rules: { ...RULES, maxRepeats: null, leftovers: false, slots: ["morning"] },
      days: weekOf(1, { kcal: 1000, protein_g: 50 }),
    }).days;

    expect(day?.status).toBe("short");
  });
});
