import { liveDaysOf } from "./planView";
import { shoppingDraftsOfPlan } from "../shopping/shoppingDraftsOfPlan";

import type { PlanDayRow, PlanRow } from "./planView";
import type { AggregatedIngredients, ShoppingIngredient } from "../shopping/aggregateIngredients";
import type { ShoppableDay, ShoppableItem } from "../shopping/shoppingDraftsOfPlan";

/** The days to buy for, both ends included, `YYYY-MM-DD`. One day has the same date at both ends. */
export type PlanShoppingScope = { start: string; end: string };

/** What buying for a scope reads and sums. Built by `planShoppingOf`. */
export type PlanShopping = {
  /**
   * Every live day of the plans, so a recipe's leftovers are found wherever they sit. A day outside the scope
   * is passed as eaten: its leftovers still count toward the servings its cook is bought for, and nothing of
   * its own is bought.
   */
  days: readonly ShoppableDay[];
  /** The recipes a cook in the scope names, each once. */
  recipeIds: readonly string[];
  /** The foods planned on their own in the scope, each once, with the name they were planned under. */
  foods: readonly { foodId: string; name: string }[];
  /** The first and last day in the scope that has something to buy. */
  firstDate: string;
  lastDate: string;
};

/** A recipe as buying reads it: its saved servings and its ingredients. */
export type PlanShoppingRecipe = {
  id: string;
  name: string;
  servings: number;
  ingredients: readonly ShoppingIngredient[];
};

/** A food as buying reads it, for the store cupboard rules. */
export type PlanShoppingFood = { id: string; name: string; food_group: string | null };

// A food or recipe that was deleted leaves its item with no id. It cannot be bought, so it is not an item here.
const shoppableItemsOf = (day: PlanDayRow): ShoppableItem[] =>
  day.items.flatMap((item): ShoppableItem[] => {
    if (item.kind === "recipe") {
      return item.recipeId === null
        ? []
        : [{ key: item.id, leftoverOf: item.leftoverOf, kind: "recipe", recipeId: item.recipeId }];
    }
    return item.foodId === null
      ? []
      : [
          {
            key: item.id,
            leftoverOf: item.leftoverOf,
            kind: "food",
            foodId: item.foodId,
            grams: item.grams,
          },
        ];
  });

const nameOfFood = (snapshot: Readonly<Record<string, unknown>>, fallback: string): string => {
  const { name } = snapshot;
  return typeof name === "string" && name !== "" ? name : fallback;
};

/**
 * What to buy for the days of the live plans from `scope.start` to `scope.end`: the days that are not confirmed
 * and hold something (a confirmed day is eaten, an empty one has nothing). Null when there is none. The newest
 * plan's day is the one used for a date several plans cover.
 */
export const planShoppingOf = (
  plans: readonly PlanRow[],
  scope: PlanShoppingScope,
): PlanShopping | null => {
  const live = liveDaysOf(plans).map(({ day }) => day);
  const isBought = (day: PlanDayRow): boolean =>
    day.localDate >= scope.start &&
    day.localDate <= scope.end &&
    day.confirmedAt === null &&
    day.items.length > 0;
  const bought = live.filter(isBought);
  const first = bought[0];
  const last = bought.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }

  const recipeIds = new Set<string>();
  const foodNames = new Map<string, string>();
  for (const day of bought) {
    for (const item of day.items) {
      if (item.kind === "recipe" && item.recipeId !== null && item.leftoverOf === null) {
        recipeIds.add(item.recipeId);
      }
      if (item.kind === "food" && item.foodId !== null && !foodNames.has(item.foodId)) {
        foodNames.set(item.foodId, nameOfFood(item.snapshot, item.foodId));
      }
    }
  }

  return {
    days: live.map((day) => ({
      isConfirmed: !isBought(day),
      items: shoppableItemsOf(day),
    })),
    recipeIds: [...recipeIds],
    foods: [...foodNames].map(([foodId, name]) => ({ foodId, name })),
    firstDate: first.localDate,
    lastDate: last.localDate,
  };
};

/**
 * The foods to buy and the store cupboard staples left out, as `shoppingDraftsOfPlan` sums them, so the preview
 * and the add give the same figures. A food that cannot be read now is bought under the name it was planned
 * under. Throws a `RangeError` for a recipe in the scope that `recipes` does not hold.
 */
export const planShoppingDraftsOf = (
  shopping: PlanShopping,
  recipes: readonly PlanShoppingRecipe[],
  foods: readonly PlanShoppingFood[],
): AggregatedIngredients =>
  shoppingDraftsOfPlan({
    days: shopping.days,
    recipes: recipes.map(({ id, name, servings, ingredients }) => ({
      recipeId: id,
      recipeName: name,
      recipeServings: servings,
      ingredients,
    })),
    foods: shopping.foods.map(({ foodId, name }) => {
      const row = foods.find(({ id }) => id === foodId);
      return row === undefined
        ? { foodId, name, food: null }
        : { foodId, name: row.name, food: { name: row.name, food_group: row.food_group } };
    }),
  });
