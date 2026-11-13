import { MEAL_PLAN_BANDS } from "./constants";
import { buildLogEntry } from "../diary/buildLogEntry";
import { buildRecipeLogEntry } from "../diary/buildRecipeLogEntry";

import type { Plan, PlanBand, PlanItem } from "./types";
import type { LoggableRecipe } from "../diary/recipeSnapshotQuantity";
import type { Food } from "../schemas/food";

/** The rules a plan is stored under: what applied, and the ranking `replan_day` reuses. */
export type StoredPlanRules = {
  maxRepeats: number | null;
  leftovers: boolean;
  slots: readonly PlanBand[];
  /** Ids, most preferred first. */
  ranking: readonly string[];
};

export type PlanSaveInputSource = {
  plan: Plan;
  rules: StoredPlanRules;
  foods: ReadonlyMap<string, Food>;
  recipes: ReadonlyMap<string, LoggableRecipe>;
};

/** `HH:MM` as the database stores a time. */
const withSeconds = (time: string): string => `${time}:00`;

/**
 * What `saveMealPlan` takes for a plan the planner built. Each item's `nutrients` are the planner's figures, and
 * its `snapshot` is the one a diary entry of the same amount would freeze, built by `buildLogEntry` or
 * `buildRecipeLogEntry`, so confirming a day later starts from the same names and figures. A leftover names the
 * item that cooked it by its day and position. Throws a `RangeError` for an item whose food or recipe is not
 * given, or a leftover whose cook is not in the plan.
 */
export const planSaveInput = ({ plan, rules, foods, recipes }: PlanSaveInputSource) => {
  const first = plan.days[0];
  if (first === undefined) {
    throw new RangeError("A plan needs at least one day");
  }
  const positionOfKey = new Map<string, { localDate: string; position: number }>();
  for (const day of plan.days) {
    day.items.forEach(({ key }, position) => {
      positionOfKey.set(key, { localDate: day.localDate, position });
    });
  }

  const itemOf = (localDate: string, item: PlanItem, position: number) => {
    const loggedAt = `${localDate}T${item.time}:00.000Z`;
    const base = {
      localDate,
      position,
      slotTime: withSeconds(item.time),
      nutrients: item.nutrients,
    };
    const cook = item.leftoverOf === null ? undefined : positionOfKey.get(item.leftoverOf);
    if (item.leftoverOf !== null && cook === undefined) {
      throw new RangeError("A leftover must name an item of the plan");
    }
    const leftover = cook === undefined ? {} : { leftoverOf: cook };
    if (item.kind === "recipe") {
      const recipe = recipes.get(item.recipeId);
      if (recipe === undefined) {
        throw new RangeError("A planned recipe must be given");
      }
      const { snapshot } = buildRecipeLogEntry({
        recipe,
        quantity: 1,
        unit: "serving",
        loggedAt,
        localDate,
      });
      return {
        ...base,
        ...leftover,
        kind: "recipe" as const,
        recipeId: item.recipeId,
        servings: item.servings,
        snapshot,
      };
    }
    const food = foods.get(item.foodId);
    if (food === undefined) {
      throw new RangeError("A planned food must be given");
    }
    const { snapshot } = buildLogEntry({
      food,
      quantity: item.grams,
      unit: "g",
      loggedAt,
      localDate,
    });
    return {
      ...base,
      ...leftover,
      kind: "food" as const,
      foodId: item.foodId,
      grams: item.grams,
      portionId: null,
      snapshot,
    };
  };

  return {
    startDate: first.localDate,
    source: "assistant" as const,
    rules: {
      maxRepeats: rules.maxRepeats,
      leftovers: rules.leftovers,
      slots: MEAL_PLAN_BANDS.filter((band) => rules.slots.includes(band)),
      ranking: [...rules.ranking],
    },
    days: plan.days.map(({ localDate, target }) => ({ localDate, target: { ...target } })),
    items: plan.days.flatMap((day) =>
      day.items.map((item, position) => itemOf(day.localDate, item, position)),
    ),
  };
};
