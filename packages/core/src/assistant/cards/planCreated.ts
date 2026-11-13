import {
  describePlanChange,
  describePlanCreatedTitle,
  describePlanDayName,
  describePlanDaySummary,
  describePlanFoodAmount,
  describePlanFoodName,
  describePlanItemDetail,
  describePlanRecipeAmount,
  describePlanUndone,
  PLAN_CARD_LINK_LABEL,
  describeRepeatLimitNote,
  describeShortDayNote,
} from "../../copy/assistantPlanCards";
import { planServingGrams } from "../../plans/planWeek";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { RepeatLimitSource } from "../../copy/assistantPlanCards";
import type { Plan, PlanItem } from "../../plans/types";

export type PlanCreatedCardInput = Readonly<{
  /** Core's plan: every figure on the card is read from its totals, never from a model. */
  plan: Plan;
  /** The limit that applied, and where it came from. A limit of null is no limit. */
  repeatLimit: Readonly<{ maxRepeats: number | null; source: RepeatLimitSource }>;
  /** The recipes the plan placed, by id: the name, and what the serving weight is worked out from. */
  recipes: ReadonlyMap<
    string,
    Readonly<{ name: string; servings: number; effectiveGrams: number }>
  >;
  /** The names of the foods the plan placed, by id. */
  foodNames: ReadonlyMap<string, string>;
}>;

/**
 * The card after `plan_meals`: "Planned 7 days, Mon 16 to Sun 22 Nov", a line for each day that opens to its
 * items, and a note that says which repeat limit applied and which days fell short. Undo
 * archives the plan.
 */
export function buildPlanCreatedCard(input: PlanCreatedCardInput): AssistantCardDraft {
  const { plan, repeatLimit } = input;
  const first = plan.days[0];
  const last = plan.days.at(-1);
  if (first === undefined || last === undefined) {
    throw new RangeError("A plan card needs at least one day");
  }
  const itemOf = (item: PlanItem) => {
    if (item.kind === "recipe") {
      const recipe = input.recipes.get(item.recipeId);
      return {
        name: recipe?.name ?? "Recipe",
        amount: describePlanRecipeAmount(recipe === undefined ? null : planServingGrams(recipe)),
      };
    }
    return {
      name: describePlanFoodName(input.foodNames.get(item.foodId) ?? "Food"),
      amount: describePlanFoodAmount(item.grams),
    };
  };
  const notes = [
    ...plan.days
      .filter(({ status }) => status === "short")
      .map(({ localDate, shortfalls }) => describeShortDayNote(localDate, shortfalls)),
    describeRepeatLimitNote(repeatLimit.maxRepeats, repeatLimit.source),
  ].filter((note): note is string => note !== null && note !== "");

  return {
    kind: "plan_created",
    title: describePlanCreatedTitle(first.localDate, last.localDate, plan.days.length),
    sub: null,
    rows: [],
    days: plan.days.map((day) => ({
      name: describePlanDayName(day.localDate, day.totals.kcal, day.target.kcal ?? null),
      summary: describePlanDaySummary(
        day.items.length,
        day.totals.protein_g,
        day.target.protein_g ?? null,
      ),
      exercises: day.items.map((item) => {
        const { name, amount } = itemOf(item);
        return {
          name,
          detail: describePlanItemDetail({
            band: item.band,
            time: item.time,
            amount,
            isLeftover: item.leftoverOf !== null,
          }),
        };
      }),
    })),
    changeDetail: describePlanChange(plan.days.length),
    totalText: null,
    note: notes.length === 0 ? null : notes.join(" "),
    link: {
      label: PLAN_CARD_LINK_LABEL,
      target: { screen: "meal_plan", localDate: first.localDate },
    },
    undo: "available",
    undoneSub: describePlanUndone(first.localDate, last.localDate),
  };
}
