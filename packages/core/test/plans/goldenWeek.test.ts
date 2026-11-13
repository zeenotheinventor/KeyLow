import { describe, expect, it } from "vitest";

import { EVAL_FOODS, EVAL_RANKING, EVAL_RECIPES, EVAL_WEEK } from "./evalKitchen";
import { planMeals, replanDay } from "../../src/plans";
import { isWithinTolerance } from "../../src/recipes";
import { shoppingDraftsOfPlan } from "../../src/shopping";
import { CHICKEN_AND_RICE, PORRIDGE_BOWL } from "../recipes/fit/seedRecipes";

import type { PlanPool } from "../../src/plans";
import type { ShoppingIngredient } from "../../src/shopping";

// The eval user's week as docs/design/kitchen/proposals/kitchen-plan.md draws it: Mon 16 to Sun 22 Nov, the
// two fixture recipes, a limit of 2, leftovers on. The board's grams were worked by hand, so this pins the
// shapes the board shows (every day within, the porridge bowl twice, the chicken and rice cooked once with its
// leftover the next day, the vegetarian Thursday short on protein only), not its grams.
const POOL: PlanPool = {
  recipes: EVAL_RECIPES,
  foods: EVAL_FOODS,
  ranking: EVAL_RANKING,
  rules: { maxRepeats: 2, leftovers: true, slots: ["morning", "midday", "evening"] },
};

const plan = planMeals({ ...POOL, days: EVAL_WEEK });
const placements = (recipeId: string) =>
  plan.days.flatMap((day) =>
    day.items.flatMap((item) =>
      item.kind === "recipe" && item.recipeId === recipeId ? [{ day, item }] : [],
    ),
  );

describe("the golden week", () => {
  it("should plan seven days, each against its own target", () => {
    expect(plan.days.map((day) => [day.localDate, day.target.kcal])).toEqual(
      EVAL_WEEK.map((day) => [day.localDate, day.target.kcal]),
    );
  });

  it("should land every day within 5 % of its calories and 5 g of its protein", () => {
    for (const day of plan.days) {
      expect(day.status).toBe("within");
      expect(isWithinTolerance(day.totals, day.target)).toBe(true);
    }
  });

  it("should use the porridge bowl twice, the limit of 2", () => {
    expect(placements("porridge-bowl")).toHaveLength(2);
  });

  it("should cook the chicken and rice once and eat its second serving the next day, in the same band", () => {
    const [cook, leftover] = placements("chicken-and-rice");

    expect(placements("chicken-and-rice")).toHaveLength(2);
    expect(cook?.item.leftoverOf).toBeNull();
    expect(leftover?.item.leftoverOf).toBe(cook?.item.key);
    expect(leftover?.item.band).toBe(cook?.item.band);
    expect(leftover?.day.localDate).toBe("2026-11-17");
  });

  it("should replan Thursday with no meat or fish as short on protein only, as the board shows", () => {
    const vegetarian: PlanPool = {
      ...POOL,
      recipes: EVAL_RECIPES.filter((recipe) => recipe.id !== "chicken-and-rice"),
      foods: EVAL_FOODS.filter((food) => food.id !== "chicken" && food.id !== "salmon"),
    };

    const replanned = replanDay(plan, "2026-11-19", vegetarian).plan;

    const thursday = replanned.days[3];
    expect(thursday?.status).toBe("short");
    expect(thursday?.shortfalls.map(({ nutrient }) => nutrient)).toEqual(["protein_g"]);
    expect(thursday?.shortfalls[0]?.target).toBe(90);
    // The board reaches 68 g with the calories within 5 %. The planner must do no worse.
    expect(thursday?.totals.protein_g).toBeGreaterThanOrEqual(68);
    expect(Math.abs((thursday?.totals.kcal ?? 0) - 1300)).toBeLessThanOrEqual(65);
    replanned.days.forEach((day, index) => {
      if (index !== 3) {
        expect(day).toBe(plan.days[index]);
      }
    });
  });
});

describe("the golden week's shopping list", () => {
  const ingredientsOf = (recipe: typeof PORRIDGE_BOWL): ShoppingIngredient[] =>
    recipe.ingredients.map(({ foodId, grams }) => ({
      foodId,
      name: foodId,
      food: { name: foodId, food_group: null },
      quantity: grams,
      unit: "g",
      resolvedGrams: grams,
      portionLabel: null,
    }));

  const list = shoppingDraftsOfPlan({
    days: plan.days.map(({ items }) => ({ isConfirmed: false, items })),
    recipes: [
      {
        recipeId: "porridge-bowl",
        recipeName: "Eval porridge bowl",
        recipeServings: 1,
        ingredients: ingredientsOf(PORRIDGE_BOWL),
      },
      {
        recipeId: "chicken-and-rice",
        recipeName: "Eval chicken and rice",
        recipeServings: 2,
        ingredients: ingredientsOf(CHICKEN_AND_RICE),
      },
    ],
    foods: EVAL_FOODS.map(({ id }) => ({
      foodId: id,
      name: id,
      food: { name: id, food_group: null },
    })),
  });

  const bought = (foodId: string): number | undefined =>
    [...list.items, ...list.staples].find((draft) => draft.foodId === foodId)?.grams;

  it("should sum every food over the week as the plan eats it, and buy the chicken and rice once", () => {
    const plainGrams = (foodId: string): number =>
      plan.days
        .flatMap((day) => day.items)
        .reduce(
          (sum, item) => sum + (item.kind === "food" && item.foodId === foodId ? item.grams : 0),
          0,
        );
    // A batch cooked for all of the recipe's servings needs the recipe's own grams.
    const recipeGrams = (recipe: typeof PORRIDGE_BOWL, foodId: string, cooks: number): number =>
      recipe.ingredients
        .filter((ingredient) => ingredient.foodId === foodId)
        .reduce((sum, { grams }) => sum + grams * cooks, 0);

    expect(bought("chicken")).toBeCloseTo(
      plainGrams("chicken") + recipeGrams(CHICKEN_AND_RICE, "chicken", 1),
      6,
    );
    expect(bought("rice")).toBeCloseTo(
      plainGrams("rice") + recipeGrams(CHICKEN_AND_RICE, "rice", 1),
      6,
    );
    expect(bought("oats")).toBeCloseTo(plainGrams("oats") + 2 * 50, 6);
    expect(bought("milk")).toBeCloseTo(2 * 200, 6);
  });

  it("should leave the olive oil out as a store cupboard staple", () => {
    expect(list.staples.some((draft) => draft.foodId === "oil")).toBe(true);
    expect(list.items.some((draft) => draft.foodId === "oil")).toBe(false);
  });
});
