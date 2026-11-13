import { PLAN_FIT_BUDGET, buildDay } from "./buildDay";
import { usageOf } from "./planMeals";
import { preparePool } from "./preparePool";

import type { RecipePlanItem } from "./buildDay";
import type { Plan, PlanPool } from "./types";

/** The plan with the day replaced, the keys of the items that were kept as they were, and `fitCalls` (a diagnostic, at most `PLAN_FIT_BUDGET`). */
export type ReplannedDay = { plan: Plan; kept: string[]; fitCalls: number };

/**
 * Plans one day of `plan` again from `pool`, against that day's own target, and returns the plan with only
 * that day replaced. Every other day is the same object, so it is untouched. Their recipes count toward
 * `rules.maxRepeats`, so the limit holds across the whole plan.
 *
 * A leftover that sat on the replaced day is dropped. A recipe cooked on the replaced day that other days
 * still eat leftovers of is kept as it was, because those days cannot change. No new leftovers are planned,
 * because they would land on days this function must not touch. Throws a `RangeError` for a date that is not
 * in the plan and for rules that cannot be planned.
 */
export const replanDay = (plan: Plan, localDate: string, pool: PlanPool): ReplannedDay => {
  const at = plan.days.findIndex((day) => day.localDate === localDate);
  const replaced = plan.days[at];
  if (replaced === undefined) {
    throw new RangeError("That day is not in the plan");
  }
  const others = plan.days.filter((_, index) => index !== at);
  const leftoverOfKeys = new Set(others.flatMap((day) => day.items.map((item) => item.leftoverOf)));
  const kept = replaced.items.filter(
    (item): item is RecipePlanItem => item.kind === "recipe" && leftoverOfKeys.has(item.key),
  );

  const { appearances, foodUse } = usageOf(others);
  const budget = { remaining: PLAN_FIT_BUDGET, refused: false };
  const { day } = buildDay({
    day: { localDate, target: replaced.target },
    pool: preparePool(pool),
    appearances,
    foodUse,
    fixed: kept,
    budget,
    leftoverRoom: () => 0,
  });

  return {
    plan: { days: plan.days.map((existing, index) => (index === at ? day : existing)) },
    kept: kept.map(({ key }) => key),
    fitCalls: PLAN_FIT_BUDGET - budget.remaining,
  };
};
