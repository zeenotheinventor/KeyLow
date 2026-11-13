import { z } from "zod";

import { foodOf, recipeOf, RULES } from "./pools";
import { planMeals, planSaveInput } from "../../src/plans";
import { buildFood } from "../../src/testing";

import type { LoggableRecipe } from "../../src/diary/recipeSnapshotQuantity";
import type {
  Plan,
  PlanFoodCandidate,
  PlanRecipeCandidate,
  StoredReplanPlan,
} from "../../src/plans";

const jsonObject = z.record(z.string(), z.json());

/** The foods and recipes as the diary snapshots read them, for a pool of candidates. */
export const rowsOf = (
  foods: readonly PlanFoodCandidate[],
  recipes: readonly PlanRecipeCandidate[],
) => ({
  foodRows: new Map(
    foods.map(({ id, per100 }) => [
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
  ),
  recipeRows: new Map(
    recipes.map(({ id, perServing, servings }): [string, LoggableRecipe] => [
      id,
      {
        id,
        name: `Recipe ${id}`,
        servings,
        yield_grams: servings * 350,
        computed: {
          total: {
            kcal: (perServing.kcal ?? 0) * servings,
            protein_g: (perServing.protein_g ?? 0) * servings,
            fat_g: (perServing.fat_g ?? 0) * servings,
            carbs_g: (perServing.carbs_g ?? 0) * servings,
            fibre_g: 0,
          },
          effectiveGrams: servings * 350,
        },
      },
    ]),
  ),
});

/** A plan as the database would hold it after `saveMealPlan`: ids on every day and item, leftovers naming their cook by id. */
export const storedPlanOf = (
  plan: Plan,
  rows: ReturnType<typeof rowsOf>,
  ranking: readonly string[],
): StoredReplanPlan => {
  const saved = planSaveInput({
    plan,
    rules: { ...RULES, ranking },
    foods: rows.foodRows,
    recipes: rows.recipeRows,
  });
  const idOf = (localDate: string, position: number) => `item-${localDate}-${position}`;
  return {
    rules: saved.rules,
    days: saved.days.map(({ localDate, target }, at) => ({
      id: `day-${at}`,
      localDate,
      target,
      confirmedAt: null,
      items: saved.items
        .filter((item) => item.localDate === localDate)
        .map((item) => {
          const cook = "leftoverOf" in item ? item.leftoverOf : undefined;
          const shared = {
            id: idOf(localDate, item.position),
            position: item.position,
            slotTime: item.slotTime,
            nutrients: jsonObject.parse(item.nutrients),
            snapshot: jsonObject.parse(item.snapshot),
            leftoverOf: cook === undefined ? null : idOf(cook.localDate, cook.position),
          };
          return item.kind === "recipe"
            ? {
                ...shared,
                kind: "recipe" as const,
                recipeId: item.recipeId,
                servings: item.servings,
              }
            : {
                ...shared,
                kind: "food" as const,
                foodId: item.foodId,
                grams: item.grams,
                portionId: null,
              };
        }),
    })),
  };
};

export const STEW = recipeOf("stew", 600, 40, 2);
export const stewFoods: PlanFoodCandidate[] = [
  foodOf("oats", 380, 11, 60, ["morning"]),
  foodOf("chicken", 148, 32, 150, ["midday", "evening"]),
  foodOf("rice", 131, 2.8, 200, ["midday", "evening"]),
];

export const stewWeek = (dayCount: number) => {
  const pool = { recipes: [STEW], foods: stewFoods, ranking: ["stew"], rules: RULES };
  const plan = planMeals({
    ...pool,
    days: Array.from({ length: dayCount }, (_, index) => ({
      localDate: `2026-11-${16 + index}`,
      target: { kcal: 1300, protein_g: 90 },
    })),
  });
  const rows = rowsOf(stewFoods, [STEW]);
  return { pool, plan, rows, stored: storedPlanOf(plan, rows, ["stew"]) };
};
