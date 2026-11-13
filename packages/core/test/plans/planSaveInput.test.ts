import { describe, expect, it } from "vitest";

import { EVAL_FOODS, EVAL_RECIPES } from "./evalKitchen";
import { planMeals, planSaveInput } from "../../src/plans";
import { buildFood } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary/recipeSnapshotQuantity";

const foods = new Map(
  EVAL_FOODS.map(({ id, per100 }) => [
    id,
    buildFood({
      id,
      name: `Food ${id}`,
      basis: "per_100g",
      kcal: per100.kcal,
      protein_g: per100.protein_g,
      fat_g: per100.fat_g,
      carbs_g: per100.carbs_g,
      fibre_g: per100.fibre_g,
    }),
  ]),
);

const recipes = new Map(
  EVAL_RECIPES.map(({ id, perServing, servings }): [string, LoggableRecipe] => [
    id,
    {
      id,
      name: `Recipe ${id}`,
      servings,
      yield_grams: servings * 350,
      computed: {
        total: perServing,
        effectiveGrams: servings * 350,
      },
    },
  ]),
);

const days = [0, 1, 2].map((offset) => ({
  localDate: `2026-11-${16 + offset}`,
  target: { kcal: 1300, protein_g: 90 },
}));

const plan = planMeals({
  recipes: EVAL_RECIPES,
  foods: EVAL_FOODS,
  ranking: [],
  rules: { maxRepeats: 2, leftovers: true, slots: ["morning", "midday", "evening"] },
  days,
});

const rules = {
  maxRepeats: 2,
  leftovers: true,
  slots: ["morning", "midday", "evening"] as const,
  ranking: ["chicken-and-rice"],
};

describe("planSaveInput", () => {
  const input = planSaveInput({ plan, rules, foods, recipes });

  it("should save the plan from its first day, as the assistant's", () => {
    expect(input.startDate).toBe("2026-11-16");
    expect(input.source).toBe("assistant");
    expect(input.days.map(({ localDate }) => localDate)).toEqual(
      days.map(({ localDate }) => localDate),
    );
  });

  it("should store the rules that applied and the ranking", () => {
    expect(input.rules).toEqual({
      maxRepeats: 2,
      leftovers: true,
      slots: ["morning", "midday", "evening"],
      ranking: ["chicken-and-rice"],
    });
  });

  it("should store the day's target as the planner used it", () => {
    expect(input.days[0]?.target).toEqual({ kcal: 1300, protein_g: 90 });
  });

  it("should give each item the planner's nutrients, its band time and a position within its day", () => {
    for (const day of plan.days) {
      const saved = input.items.filter(({ localDate }) => localDate === day.localDate);
      expect(saved.map(({ position }) => position)).toEqual(day.items.map((_, at) => at));
      expect(saved.map(({ nutrients }) => nutrients)).toEqual(
        day.items.map(({ nutrients }) => nutrients),
      );
      expect(saved.map(({ slotTime }) => slotTime)).toEqual(
        day.items.map(({ time }) => `${time}:00`),
      );
    }
  });

  it("should freeze the snapshot a diary entry would", () => {
    const food = input.items.find((item) => item.kind === "food");
    const recipe = input.items.find((item) => item.kind === "recipe");

    expect(food?.snapshot).toMatchObject({ kind: "food", unit: "g" });
    expect(recipe?.snapshot).toMatchObject({ kind: "recipe", unit: "serving", quantity: 1 });
  });

  it("should name the cooking item of a leftover by its day and position", () => {
    const leftover = input.items.find((item) => item.leftoverOf !== undefined);

    expect(leftover?.leftoverOf.localDate).toMatch(/^2026-11-1\d$/);
    expect(Number.isInteger(leftover?.leftoverOf.position)).toBe(true);
  });

  it("should throw for an item whose food or recipe is not given", () => {
    expect(() => planSaveInput({ plan, rules, foods: new Map(), recipes })).toThrow(RangeError);
    expect(() => planSaveInput({ plan, rules, foods, recipes: new Map() })).toThrow(RangeError);
  });
});
