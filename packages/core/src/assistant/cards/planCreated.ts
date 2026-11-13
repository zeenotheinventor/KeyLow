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
  describeRepeatLimitNote,
  describeShortDayNote,
} from "../../copy/assistantPlanCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { RepeatLimitSource } from "../../copy/assistantPlanCards";
import type { Plan, PlanItem } from "../../plans/types";

export type PlanCreatedCardInput = Readonly<{
  /** Core's plan: every figure on the card is read from its totals, never from a model. */
  plan: Plan;
  /** The limit that applied, and where it came from. A limit of null is no limit. */
  repeatLimit: Readonly<{ maxRepeats: number | null; source: RepeatLimitSource }>;
  /** The names of the recipes and foods the plan placed, by id. */
  recipeNames: ReadonlyMap<string, string>;
  foodNames: ReadonlyMap<string, string>;
  /** The weight of one serving of each recipe that has one, by id. */
  recipeServingGrams: ReadonlyMap<string, number>;
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
  const itemOf = (item: PlanItem) =>
    item.kind === "recipe"
      ? {
          name: input.recipeNames.get(item.recipeId) ?? "Recipe",
          amount: describePlanRecipeAmount(input.recipeServingGrams.get(item.recipeId) ?? null),
        }
      : {
          name: describePlanFoodName(input.foodNames.get(item.foodId) ?? "Food"),
          amount: describePlanFoodAmount(item.grams),
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
    // The Plan screen has no link target in the card contract yet, so the card has no link (KEY-1018).
    link: null,
    undo: "available",
    undoneSub: describePlanUndone(first.localDate, last.localDate),
  };
}
