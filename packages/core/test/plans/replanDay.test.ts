import { describe, expect, it } from "vitest";

import { foodOf, poolOf, recipeOf, RULES, STAPLE_FOODS, weekOf } from "./pools";
import { planMeals, replanDay } from "../../src/plans";

import type { Plan, PlanItem } from "../../src/plans";

const BOWL = recipeOf("bowl", 500, 30, 1);
const STEW = recipeOf("stew", 600, 40, 2);

const recipeItems = (plan: Plan, recipeId: string): PlanItem[] =>
  plan.days.flatMap((day) =>
    day.items.filter((item) => item.kind === "recipe" && item.recipeId === recipeId),
  );

describe("replanDay", () => {
  const pool = poolOf({ recipes: [BOWL, STEW], ranking: ["stew", "bowl"] });
  const plan = planMeals({ ...pool, days: weekOf(7) });

  it("should leave every other day exactly as it was", () => {
    const replanned = replanDay(plan, "2026-11-19", pool).plan;

    plan.days.forEach((day, index) => {
      if (day.localDate !== "2026-11-19") {
        expect(replanned.days[index]).toBe(day);
      }
    });
  });

  it("should keep the day's own frozen target", () => {
    const differing = planMeals({
      ...pool,
      days: [
        { localDate: "2026-11-16", target: { kcal: 1300, protein_g: 90 } },
        { localDate: "2026-11-17", target: { kcal: 1550, protein_g: 95 } },
      ],
    });

    const replanned = replanDay(differing, "2026-11-17", pool).plan;

    expect(replanned.days[1]?.target).toEqual({ kcal: 1550, protein_g: 95 });
  });

  it("should plan the day again from the foods it is given", () => {
    const withoutChicken = { ...pool, foods: STAPLE_FOODS.filter((food) => food.id !== "chicken") };

    const replanned = replanDay(plan, "2026-11-19", withoutChicken).plan;

    const day = replanned.days[3];
    expect(day?.items.some((item) => item.kind === "food" && item.foodId === "chicken")).toBe(
      false,
    );
    expect(day?.localDate).toBe("2026-11-19");
  });

  it("should count the other days toward the repeat limit", () => {
    const limited = { ...pool, rules: { ...RULES, maxRepeats: 2 } };
    const bowlOnly = poolOf({ recipes: [BOWL], ranking: ["bowl"], rules: limited.rules });
    const original = planMeals({ ...bowlOnly, days: weekOf(7) });
    const [first, second] = recipeItems(original, "bowl");
    const freeDay = original.days.find(
      (day) =>
        day.localDate !== first?.key.split("/")[0] && day.localDate !== second?.key.split("/")[0],
    );

    const replanned = replanDay(original, freeDay?.localDate ?? "", bowlOnly).plan;

    expect(recipeItems(replanned, "bowl")).toHaveLength(2);
  });

  it("should let a day that held a recipe place it again", () => {
    const bowlOnly = poolOf({ recipes: [BOWL], ranking: ["bowl"] });
    const original = planMeals({ ...bowlOnly, days: weekOf(7) });
    const holding = original.days.find((day) => day.items.some((item) => item.kind === "recipe"));

    const replanned = replanDay(original, holding?.localDate ?? "", bowlOnly).plan;

    expect(recipeItems(replanned, "bowl")).toHaveLength(2);
  });

  it("should drop a leftover that sat on the replaced day and leave its cook alone", () => {
    const stewOnly = poolOf({ recipes: [STEW], ranking: ["stew"] });
    const original = planMeals({ ...stewOnly, days: weekOf(3) });
    const cookDay = original.days.find((day) =>
      day.items.some((item) => item.kind === "recipe" && item.leftoverOf === null),
    );
    const leftoverDay = original.days.find((day) =>
      day.items.some((item) => item.leftoverOf !== null),
    );

    const replanned = replanDay(original, leftoverDay?.localDate ?? "", stewOnly).plan;

    expect(replanned.days.find((day) => day.localDate === cookDay?.localDate)).toBe(cookDay);
    const replacement = replanned.days.find((day) => day.localDate === leftoverDay?.localDate);
    expect(replacement?.items.filter((item) => item.leftoverOf !== null)).toEqual([]);
  });

  it("should keep a cooked recipe whose leftovers sit on other days", () => {
    const stewOnly = poolOf({ recipes: [STEW], ranking: ["stew"] });
    const original = planMeals({ ...stewOnly, days: weekOf(3) });
    const cookDay = original.days.find((day) =>
      day.items.some((item) => item.kind === "recipe" && item.leftoverOf === null),
    );

    const { plan: replanned, kept } = replanDay(original, cookDay?.localDate ?? "", stewOnly);

    const replacement = replanned.days.find((day) => day.localDate === cookDay?.localDate);
    const cook = cookDay?.items.find((item) => item.kind === "recipe");
    expect(replacement?.items).toContainEqual(cook);
    expect(kept).toEqual([cook?.key]);
    for (const leftover of recipeItems(replanned, "stew").filter((item) => item.leftoverOf)) {
      expect(replanned.days.flatMap((day) => day.items.map((item) => item.key))).toContain(
        leftover.leftoverOf,
      );
    }
  });

  it("should keep nothing when no other day eats from the replaced day", () => {
    expect(replanDay(plan, "2026-11-19", pool).kept).toEqual([]);
  });

  it("should say so when a day cannot be met", () => {
    const lowProtein = { ...pool, recipes: [], foods: [foodOf("rice", 131, 2.8, 200)] };

    const replanned = replanDay(plan, "2026-11-19", lowProtein).plan;

    const day = replanned.days[3];
    expect(day?.status).toBe("short");
    expect(day?.shortfalls.some((shortfall) => shortfall.nutrient === "protein_g")).toBe(true);
  });

  it("should refuse a day that is not in the plan", () => {
    expect(() => replanDay(plan, "2027-01-01", pool)).toThrow(RangeError);
  });

  it("should give the same day for the same input", () => {
    expect(replanDay(plan, "2026-11-19", pool).plan).toEqual(
      replanDay(plan, "2026-11-19", pool).plan,
    );
  });
});
