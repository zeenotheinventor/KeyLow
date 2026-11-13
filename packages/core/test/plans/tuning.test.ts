import { describe, expect, it } from "vitest";

import { foodOf, RULES, weekOf } from "./pools";
import { planMeals } from "../../src/plans";
import {
  FOOD_REUSE_PENALTY,
  GROWTH_SHARE,
  ALL_FOODS_FIT_LIMIT,
  FALLBACK_FIT_RESERVE,
  MAX_ATTEMPTS,
  PLAN_FIT_BUDGET,
  MAX_FOODS_PER_DAY,
  UNKNOWN_DISTANCE,
} from "../../src/plans/buildDay";

describe("the planner's tuning", () => {
  it("should hold the knobs that have no behaviour of their own at their stated values", () => {
    expect({
      ALL_FOODS_FIT_LIMIT,
      FALLBACK_FIT_RESERVE,
      GROWTH_SHARE,
      PLAN_FIT_BUDGET,
      MAX_ATTEMPTS,
      UNKNOWN_DISTANCE,
    }).toEqual({
      ALL_FOODS_FIT_LIMIT: 20,
      FALLBACK_FIT_RESERVE: 6,
      GROWTH_SHARE: 0.9,
      PLAN_FIT_BUDGET: 50,
      MAX_ATTEMPTS: 10,
      UNKNOWN_DISTANCE: 1000,
    });
  });

  it("should never put more than 9 foods in a day, even one that cannot reach its calories", () => {
    const tiny = Array.from({ length: 20 }, (_, at) => foodOf(`tiny-${at}`, 10, 0, 50));

    const [day] = planMeals({
      recipes: [],
      foods: tiny,
      ranking: [],
      rules: RULES,
      days: weekOf(1, { kcal: 3000 }),
    }).days;

    expect(MAX_FOODS_PER_DAY).toBe(9);
    expect(day?.items).toHaveLength(9);
  });

  it("should count a food already eaten as 2 places further down the ranking", () => {
    const meals = ["a", "b", "c"].map((id) => foodOf(id, 500, 0, 100, ["morning"]));

    const plan = planMeals({
      recipes: [],
      foods: meals,
      ranking: ["a", "b", "c"],
      rules: { ...RULES, slots: ["morning"] },
      days: weekOf(3, { kcal: 500 }),
    });

    expect(FOOD_REUSE_PENALTY).toBe(2);
    expect(
      plan.days.map((day) => day.items.map((item) => (item.kind === "food" ? item.foodId : ""))),
    ).toEqual([["a"], ["b"], ["a"]]);
  });
});
