import type { FitMissReason, FitNutrient, FitTarget } from "../recipes/fit";
import type { NullableNutrients } from "../schemas/nutrients";

/** Morning, midday and evening, split at 11:00 and 16:00 as the palate view splits the day. */
export type PlanBand = "morning" | "midday" | "evening";

/** A recipe the planner may place. One placement is one serving. */
export type PlanRecipeCandidate = {
  id: string;
  /** What one serving holds. A recipe with no calorie figure is never placed. */
  perServing: NullableNutrients;
  /** How many servings one cook makes. The rest of a cook becomes leftovers on the next days. */
  servings: number;
  /** The bands the recipe suits. */
  bands: readonly PlanBand[];
};

/** A food the planner may place. Its grams move, between half and double `typicalGrams`, to close a day. */
export type PlanFoodCandidate = {
  id: string;
  per100: NullableNutrients;
  typicalGrams: number;
  bands: readonly PlanBand[];
};

export type PlanRules = {
  /** How many times one recipe may appear in the plan, leftovers included. Null means no limit. */
  maxRepeats: number | null;
  leftovers: boolean;
  /** The bands to plan. */
  slots: readonly PlanBand[];
};

/** What the planner chooses from. */
export type PlanPool = {
  recipes: readonly PlanRecipeCandidate[];
  foods: readonly PlanFoodCandidate[];
  /**
   * Candidate ids, most preferred first, from a model. Untrusted: an entry that is not the id of a candidate
   * is ignored, a repeated id counts once, and it can only reorder what the planner is offered.
   */
  ranking: readonly unknown[];
  rules: PlanRules;
};

export type PlanDayInput = { localDate: string; target: FitTarget };

export type PlanMealsInput = PlanPool & {
  /** One to 7 consecutive calendar days, each with its own target. */
  days: readonly PlanDayInput[];
};

type PlanItemBase = {
  /** `localDate/band/id`, unique in a plan. A leftover names the item that cooked it by this key. */
  key: string;
  band: PlanBand;
  /** `HH:MM`, the band's time. */
  time: string;
  /** What this item holds, frozen when planned. */
  nutrients: NullableNutrients;
  /** The key of the item that cooked this serving, or null when this item is not a leftover. */
  leftoverOf: string | null;
};

export type PlanItem =
  | (PlanItemBase & { kind: "recipe"; recipeId: string; servings: 1 })
  | (PlanItemBase & { kind: "food"; foodId: string; grams: number });

/** A named target a day does not meet, and why. `achieved` is null when no item has a figure for it. */
export type PlanShortfall = {
  nutrient: FitNutrient;
  target: number;
  achieved: number | null;
  /**
   * The fitter's reason, or `work_limit` when the plan ran out of its fit budget (`PLAN_FIT_BUDGET`) before this
   * day could be tried properly, so a day marked so may have been reachable.
   */
  reason: FitMissReason | "work_limit";
};

export type PlanDay = {
  localDate: string;
  target: FitTarget;
  items: PlanItem[];
  /** Core's sum of the items. Never a model's figure. */
  totals: NullableNutrients;
  status: "within" | "short";
  /** Empty when the day is within. */
  shortfalls: PlanShortfall[];
};

export type Plan = { days: PlanDay[] };

/**
 * What `planMeals` returns: the plan, and `fitCalls`, how many `fitRecipeToTargets` calls it made. A diagnostic
 * only, never stored. It is at most `PLAN_FIT_BUDGET`, which is the cap on the planner's work.
 */
export type PlannedWeek = Plan & { fitCalls: number };
