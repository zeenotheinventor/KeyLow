import { describe, expect, it } from "vitest";

import { foodOf, poolOf, recipeOf, RULES, STAPLE_FOODS, weekOf } from "./pools";
import { sumNutrients } from "../../src/nutrition";
import { planMeals } from "../../src/plans";
import { isWithinTolerance } from "../../src/recipes";

import type { Plan, PlanItem } from "../../src/plans";

const recipeItems = (plan: Plan, recipeId: string): PlanItem[] =>
  plan.days.flatMap((day) =>
    day.items.filter((item) => item.kind === "recipe" && item.recipeId === recipeId),
  );

const STEW = recipeOf("stew", 600, 40, 2);

describe("planMeals", () => {
  it("should plan one day for each day asked, each with its own target", () => {
    const days = [
      { localDate: "2026-11-16", target: { kcal: 1300, protein_g: 90 } },
      { localDate: "2026-11-17", target: { kcal: 1550, protein_g: 95 } },
    ];

    const plan = planMeals({ ...poolOf(), days });

    expect(plan.days.map((day) => [day.localDate, day.target])).toEqual(
      days.map((day) => [day.localDate, day.target]),
    );
  });

  it("should land every day within tolerance when the foods can reach the target", () => {
    const plan = planMeals({ ...poolOf(), days: weekOf(7) });

    for (const day of plan.days) {
      expect(day.status).toBe("within");
      expect(day.shortfalls).toEqual([]);
      expect(isWithinTolerance(day.totals, day.target)).toBe(true);
    }
  });

  it("should state a day's totals as core's sum of its items", () => {
    const plan = planMeals({ ...poolOf({ recipes: [STEW] }), days: weekOf(3) });

    for (const day of plan.days) {
      expect(day.totals).toEqual(sumNutrients(day.items.map((item) => item.nutrients)));
    }
  });

  it("should put each item in a band at that band's time", () => {
    const plan = planMeals({ ...poolOf({ recipes: [STEW] }), days: weekOf(2) });
    const times = { morning: "07:30", midday: "12:30", evening: "19:00" };

    for (const item of plan.days.flatMap((day) => day.items)) {
      expect(item.time).toBe(times[item.band]);
    }
  });

  it("should keep to the bands asked for", () => {
    const plan = planMeals({
      ...poolOf(),
      days: weekOf(1, { kcal: 700, protein_g: 45 }),
      rules: { ...RULES, slots: ["midday"] },
    });

    expect(new Set(plan.days.flatMap((day) => day.items.map((item) => item.band)))).toEqual(
      new Set(["midday"]),
    );
  });

  it("should say which nutrient a day cannot reach, and why, when it is short", () => {
    const plan = planMeals({ ...poolOf(), days: weekOf(1, { kcal: 6000 }) });

    const [day] = plan.days;
    expect(day?.status).toBe("short");
    const kcal = day?.shortfalls.find((shortfall) => shortfall.nutrient === "kcal");
    expect(kcal).toMatchObject({ target: 6000, reason: "ingredient_bounds" });
    expect(kcal?.achieved).toBeLessThan(5700);
  });

  it("should report a short day with nothing to place at all", () => {
    const plan = planMeals({ ...poolOf({ foods: [] }), days: weekOf(1) });

    expect(plan.days[0]?.items).toEqual([]);
    expect(plan.days[0]?.status).toBe("short");
    expect(plan.days[0]?.shortfalls.map((shortfall) => shortfall.nutrient)).toEqual([
      "kcal",
      "protein_g",
    ]);
  });

  it("should follow the preference ranking when choosing what to cook", () => {
    const other = recipeOf("curry", 600, 40, 1);
    const first = planMeals({
      ...poolOf({ recipes: [STEW, other], ranking: ["curry", "stew"] }),
      days: weekOf(1),
    });
    const second = planMeals({
      ...poolOf({ recipes: [STEW, other], ranking: ["stew", "curry"] }),
      days: weekOf(1),
    });

    expect(recipeItems(first, "curry")).toHaveLength(1);
    expect(recipeItems(first, "stew")).toHaveLength(0);
    expect(recipeItems(second, "stew")).toHaveLength(1);
  });

  it("should ignore a ranking entry that is not a candidate, or not an id", () => {
    const clean = planMeals({ ...poolOf({ recipes: [STEW], ranking: ["stew"] }), days: weekOf(7) });
    const noisy = planMeals({
      ...poolOf({
        recipes: [STEW],
        ranking: ["ghost", 7, null, { id: "stew" }, "stew", "stew", "ghost"],
      }),
      days: weekOf(7),
    });

    expect(noisy).toEqual(clean);
  });

  it("should give the same plan for the same input", () => {
    const input = { ...poolOf({ recipes: [STEW], ranking: ["stew", "salmon"] }), days: weekOf(7) };

    expect(planMeals(input)).toEqual(planMeals(input));
  });

  it("should not change what it was given", () => {
    const input = { ...poolOf({ recipes: [STEW] }), days: weekOf(3) };
    const before = structuredClone(input);

    planMeals(input);

    expect(input).toEqual(before);
  });
});

describe("planMeals repeat limit", () => {
  it("should place a recipe no more often than the limit", () => {
    const single = recipeOf("bowl", 500, 30, 1);
    const plan = planMeals({
      ...poolOf({ recipes: [single], ranking: ["bowl"] }),
      rules: { ...RULES, maxRepeats: 2 },
      days: weekOf(7),
    });

    expect(recipeItems(plan, "bowl")).toHaveLength(2);
  });

  it("should allow a recipe on every day when there is no limit", () => {
    const single = recipeOf("bowl", 500, 30, 1);
    const plan = planMeals({
      ...poolOf({ recipes: [single], ranking: ["bowl"] }),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(7),
    });

    expect(recipeItems(plan, "bowl")).toHaveLength(7);
  });

  it("should allow a recipe once a week at a limit of 1", () => {
    const single = recipeOf("bowl", 500, 30, 1);
    const plan = planMeals({
      ...poolOf({ recipes: [single], ranking: ["bowl"] }),
      rules: { ...RULES, maxRepeats: 1 },
      days: weekOf(7),
    });

    expect(recipeItems(plan, "bowl")).toHaveLength(1);
  });

  it("should not place a recipe twice on one day", () => {
    const single = recipeOf("bowl", 400, 30, 1, ["morning", "midday", "evening"]);
    const plan = planMeals({
      ...poolOf({ recipes: [single], ranking: ["bowl"] }),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(3),
    });

    for (const day of plan.days) {
      expect(day.items.filter((item) => item.kind === "recipe")).toHaveLength(1);
    }
  });
});

describe("planMeals leftovers", () => {
  it("should serve the rest of a batch the next day in the same band", () => {
    const plan = planMeals({
      ...poolOf({ recipes: [STEW], ranking: ["stew"] }),
      rules: { ...RULES, maxRepeats: 2 },
      days: weekOf(3),
    });

    const [cook, leftover] = recipeItems(plan, "stew");
    expect(cook?.leftoverOf).toBeNull();
    expect(leftover?.leftoverOf).toBe(cook?.key);
    expect(leftover?.band).toBe(cook?.band);
    expect(plan.days[1]?.items).toContainEqual(leftover);
  });

  it("should count a leftover toward the limit", () => {
    const batch = recipeOf("batch", 600, 40, 4);
    const plan = planMeals({
      ...poolOf({ recipes: [batch], ranking: ["batch"] }),
      rules: { ...RULES, maxRepeats: 3 },
      days: weekOf(7),
    });

    expect(recipeItems(plan, "batch")).toHaveLength(3);
  });

  it("should cook a batch of every serving when there is no limit", () => {
    const batch = recipeOf("batch", 600, 40, 4);
    const plan = planMeals({
      ...poolOf({ recipes: [batch], ranking: ["batch"] }),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(7),
    });

    const items = recipeItems(plan, "batch");
    const cooks = items.filter((item) => item.leftoverOf === null);
    expect(items).toHaveLength(7);
    expect(cooks).toHaveLength(2);
    expect(items.filter((item) => item.leftoverOf === cooks[0]?.key).length).toBeLessThanOrEqual(3);
  });

  it("should cook once for one meal when a limit of 1 leaves no room for a leftover", () => {
    const plan = planMeals({
      ...poolOf({ recipes: [STEW], ranking: ["stew"] }),
      rules: { ...RULES, maxRepeats: 1 },
      days: weekOf(3),
    });

    expect(recipeItems(plan, "stew").map((item) => item.leftoverOf)).toEqual([null]);
  });

  it("should not plan a leftover past the last day", () => {
    const plan = planMeals({
      ...poolOf({ recipes: [STEW], ranking: ["stew"] }),
      rules: { ...RULES, maxRepeats: null },
      days: weekOf(1),
    });

    expect(recipeItems(plan, "stew").map((item) => item.leftoverOf)).toEqual([null]);
  });

  it("should plan no leftovers when they are switched off", () => {
    const plan = planMeals({
      ...poolOf({ recipes: [STEW], ranking: ["stew"] }),
      rules: { ...RULES, leftovers: false },
      days: weekOf(7),
    });

    expect(
      plan.days.flatMap((day) => day.items).filter((item) => item.leftoverOf !== null),
    ).toEqual([]);
  });
});

describe("planMeals input checks", () => {
  const refuses = (input: Parameters<typeof planMeals>[0]): void => {
    expect(() => planMeals(input)).toThrow(RangeError);
  };

  it("should refuse no days", () => {
    refuses({ ...poolOf(), days: [] });
  });

  it("should refuse more than 7 days", () => {
    refuses({ ...poolOf(), days: weekOf(7).concat([{ localDate: "2026-11-23", target: {} }]) });
  });

  it("should refuse days that are not consecutive", () => {
    refuses({ ...poolOf(), days: weekOf(3).filter((_, at) => at !== 1) });
  });

  it("should refuse a repeat limit that is not 1 to 7 or null", () => {
    refuses({ ...poolOf(), rules: { ...RULES, maxRepeats: 0 }, days: weekOf(1) });
    refuses({ ...poolOf(), rules: { ...RULES, maxRepeats: 8 }, days: weekOf(1) });
  });

  it("should refuse no bands to plan", () => {
    refuses({ ...poolOf(), rules: { ...RULES, slots: [] }, days: weekOf(1) });
  });

  it("should leave out a candidate it cannot place", () => {
    const plan = planMeals({
      ...poolOf({
        foods: [...STAPLE_FOODS, foodOf("bad", 100, 5, 0), foodOf("nokcal", 0, 0, 50, [])],
      }),
      days: weekOf(1),
    });

    const ids = plan.days.flatMap((day) => day.items.map((item) => item.key));
    expect(ids.some((key) => key.endsWith("/bad") || key.endsWith("/nokcal"))).toBe(false);
  });
});
