import { describe, expect, it } from "vitest";

import { EVAL_FOODS, EVAL_RECIPES } from "./evalKitchen";
import { planDaysOf, planHasNoItems, planMeals, planServingGrams, planWeek } from "../../src/plans";

const days = [0, 1, 2].map((offset) => ({
  localDate: `2026-11-${16 + offset}`,
  target: { kcal: 1300, protein_g: 90 },
}));
const rules = { maxRepeats: 2, leftovers: true, slots: ["morning", "midday", "evening"] } as const;
const pool = { recipes: EVAL_RECIPES, foods: EVAL_FOODS, rules, days };

describe("planWeek", () => {
  it("should plan the whole pool when there are no wishes", () => {
    const { plan, wishesKept } = planWeek({ ...pool, ranking: ["chicken"], hasWishes: false });

    expect(wishesKept).toBe(true);
    expect(plan).toEqual(planMeals({ ...pool, ranking: ["chicken"] }));
  });

  it("should plan only the ranked items when there are wishes", () => {
    const ranking = ["oats", "banana", "chicken", "rice", "broccoli"];

    const { plan, wishesKept } = planWeek({ ...pool, ranking, hasWishes: true });

    const ids = plan.days.flatMap(({ items }) =>
      items.map((item) => (item.kind === "food" ? item.foodId : item.recipeId)),
    );
    expect(wishesKept).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => ranking.includes(id))).toBe(true);
  });

  it("should fall back to the whole pool, and say so, when the ranked items place nothing", () => {
    const { plan, wishesKept } = planWeek({
      ...pool,
      recipes: [],
      ranking: ["not-offered-but-ranked"],
      hasWishes: true,
    });

    expect(wishesKept).toBe(false);
    expect(planHasNoItems(plan)).toBe(false);
  });

  it("should plan the whole pool when the ranking is empty, with wishes", () => {
    expect(planWeek({ ...pool, ranking: [], hasWishes: true }).wishesKept).toBe(true);
  });
});

describe("planDaysOf", () => {
  const figures = () => ({ kcal: 1300, protein_g: 90, carbs_g: null, fat_g: null });

  it("should give each date its target", () => {
    expect(planDaysOf(["2026-11-16", "2026-11-17"], figures, [])).toEqual([
      { localDate: "2026-11-16", target: { kcal: 1300, protein_g: 90 } },
      { localDate: "2026-11-17", target: { kcal: 1300, protein_g: 90 } },
    ]);
  });

  it("should give nothing when a day has no calorie target", () => {
    expect(planDaysOf(["2026-11-16"], () => ({ ...figures(), kcal: null }), [])).toBeNull();
  });
});

describe("planServingGrams", () => {
  it("should be the cooked weight over the servings", () => {
    expect(planServingGrams({ servings: 2, effectiveGrams: 700 })).toBe(350);
  });

  it("should be null for a recipe with no weight or no servings", () => {
    expect(planServingGrams({ servings: 2, effectiveGrams: 0 })).toBeNull();
    expect(planServingGrams({ servings: 0, effectiveGrams: 700 })).toBeNull();
  });
});

describe("planHasNoItems", () => {
  it("should be true only when every day is empty", () => {
    expect(planHasNoItems({ days: [] })).toBe(true);
    expect(planHasNoItems(planMeals({ ...pool, ranking: [] }))).toBe(false);
  });
});
