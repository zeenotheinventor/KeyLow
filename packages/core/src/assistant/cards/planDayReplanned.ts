import {
  PLAN_CARD_LINK_LABEL,
  describeKeptCooksNote,
  describePlanBandKcal,
  describePlanBandName,
  describePlanChange,
  describePlanDayFigures,
  describePlanDayReplannedTitle,
  describePlanDayUndone,
  describePlanFoodName,
  describeReplannedDayNote,
} from "../../copy/assistantPlanCards";
import { MEAL_PLAN_BANDS } from "../../plans/constants";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { PlanDay, PlanItem } from "../../plans/types";

export type PlanDayReplannedCardInput = Readonly<{
  /** Core's replanned day: every figure on the card is read from its totals, never from a model. */
  day: PlanDay;
  /** The keys of the items kept because other days eat their leftovers. */
  kept: readonly string[];
  /** The names of the recipes the day placed, by id. */
  recipeNames: ReadonlyMap<string, string>;
  /** The names of the foods the day placed, by id. */
  foodNames: ReadonlyMap<string, string>;
}>;

/**
 * The card after `replan_day`: "Replanned Thu 19 Nov", the day's figures against its target, a row for each
 * band with what it holds and its calories, and a note for a miss and for a cook that was kept. A day within
 * tolerance has no miss note. Undo puts the day back as it was.
 */
export function buildPlanDayReplannedCard(input: PlanDayReplannedCardInput): AssistantCardDraft {
  const { day } = input;
  const nameOf = (item: PlanItem): string =>
    item.kind === "recipe"
      ? (input.recipeNames.get(item.recipeId) ?? "Recipe")
      : describePlanFoodName(input.foodNames.get(item.foodId) ?? "Food");
  const rows = MEAL_PLAN_BANDS.flatMap((band) => {
    const items = day.items.filter((item) => item.band === band);
    const [first] = items;
    if (first === undefined) {
      return [];
    }
    const known = items.flatMap(({ nutrients }) =>
      nutrients.kcal === null ? [] : [nutrients.kcal],
    );
    return [
      {
        name: describePlanBandName(band, first.time),
        amountText: items.map(nameOf).join(", "),
        time: null,
        kcalText:
          known.length === 0
            ? null
            : describePlanBandKcal(known.reduce((sum, kcal) => sum + kcal, 0)),
        match: null,
        matchedFood: null,
        estimate: false,
      },
    ];
  });
  const keptNames = day.items.flatMap((item) =>
    item.kind === "recipe" && input.kept.includes(item.key) ? [nameOf(item)] : [],
  );
  const notes = [
    ...(day.status === "short" ? [describeReplannedDayNote(day.shortfalls)] : []),
    ...(keptNames.length > 0 ? [describeKeptCooksNote(keptNames)] : []),
  ].filter((note) => note !== "");

  return {
    kind: "plan_day_replanned",
    title: describePlanDayReplannedTitle(day.localDate),
    sub: describePlanDayFigures(
      day.totals.kcal,
      day.target.kcal ?? null,
      day.totals.protein_g,
      day.target.protein_g ?? null,
    ),
    rows,
    changeDetail: describePlanChange(1),
    totalText: null,
    note: notes.length === 0 ? null : notes.join(" "),
    link: {
      label: PLAN_CARD_LINK_LABEL,
      target: { screen: "meal_plan", localDate: day.localDate },
    },
    undo: "available",
    undoneSub: describePlanDayUndone(day.localDate),
  };
}
