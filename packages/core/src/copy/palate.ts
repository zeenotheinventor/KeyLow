import { joinNames } from "./assistantEntryCards";
import { describeCount } from "./counts";
import { formatGrams } from "../format/numbers";
import { formatScaledCount } from "../format/scaledCount";
import { PALATE_USUAL_MIN_DAYS, PALATE_WINDOW_DAYS } from "../palate/constants";

import type { PalateGroup } from "../palate/palateGroups";

/**
 * The words of the "What you usually eat" screen (the boards `kitchen · palate`, `kitchen · palate-empty`
 * and `kitchen · palate-corrected`). The sentences that name foods, groups and allergies are the
 * `describe...` functions below, which `summaryLines` in the palate module puts together.
 */
export const PALATE_WORDS = {
  title: "What you usually eat",
  subLine: "Your habits, as the assistant sees them",
  back: "Back to Assistant",
  caption: `From what you logged in the last ${PALATE_WINDOW_DAYS} days. The assistant uses this when it suggests recipes and meal plans.`,
  usualFoods: "Usual foods",
  usualRecipes: "Usual recipes",
  byTimeOfDay: "By time of day",
  rarelyOrNever: "Rarely or never",
  foodsYouAvoid: "Foods you avoid",
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  notTrue: "Not true",
  correctedDetail: "You said this is not usual",
  undo: "Undo",
  allergy: "Allergy",
  dislike: "Dislike",
  /** The link under the avoid list, to the screen that changes it. */
  foodsToAvoidLink: "Foods to avoid",
  avoidCaption: "Allergies are matched by food name only. Always check labels yourself.",
  noneYet: "None yet",
  noneYetCaption: "The assistant already leaves these out, even before it knows your habits.",
  emptyTitle: "Not enough to go on yet",
  loadFailedTitle: "Couldn't load what you usually eat",
  loadFailedBody: "Check your connection and try again.",
};

const capitalise = (text: string): string => `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

/** "You eat apples, broccoli, eggs and bread on most days." */
export const describeUsualMostDays = (names: readonly string[]): string =>
  `You eat ${joinNames(names)} on most days.`;

/**
 * "Yogurt, porridge oats, chicken and rice come up most weeks." One name has no verb to agree with, so it
 * reads "You eat apples most weeks."
 */
export const describeUsualMostWeeks = (names: readonly string[]): string =>
  names.length === 1
    ? `You eat ${names[0]} most weeks.`
    : `${capitalise(joinNames(names))} come up most weeks.`;

/**
 * "You rarely or never log legumes and nuts, sweets and snacks, or drinks." The comma before "or" stays
 * with two groups, because a group's name holds an "and" of its own.
 */
export const describeRareSummary = (groups: readonly PalateGroup[]): string =>
  `You rarely or never log ${
    groups.length < 2 ? (groups[0] ?? "") : `${groups.slice(0, -1).join(", ")}, or ${groups.at(-1)}`
  }.`;

/** "You avoid peanuts (allergy), mushrooms and coriander." */
export const describeAvoidSummary = (
  items: readonly { label: string; kind: "allergy" | "dislike" }[],
): string =>
  `You avoid ${joinNames(
    items.map(
      ({ label, kind }) => `${label.toLowerCase()}${kind === "allergy" ? " (allergy)" : ""}`,
    ),
  )}.`;

/** "28 days · usually 100 g", or only the days when the food has no weight. */
export const describeFoodDetail = (days: number, typicalGrams: number | null): string =>
  typicalGrams === null
    ? describeCount(days, "day", "days")
    : `${describeCount(days, "day", "days")} · usually ${formatGrams(typicalGrams)} g`;

/** "14 days · usually 1 serving", or only the days when the recipe has no weight. */
export const describeRecipeDetail = (days: number, typicalServings: number | null): string =>
  typicalServings === null
    ? describeCount(days, "day", "days")
    : `${describeCount(days, "day", "days")} · usually ${
        typicalServings === 1 ? "1 serving" : `${formatScaledCount(typicalServings)} servings`
      }`;

/** The foods of a time of day: "Yogurt, apples and porridge oats". */
export const describeBandFoods = (names: readonly string[]): string => capitalise(joinNames(names));

/** A group's title in the rare list: "Legumes and nuts". */
export const describeGroupTitle = (group: PalateGroup): string => capitalise(group);

/** The detail of a group in the rare list. */
export const describeRareGroupDetail = (logCount: 0 | 1): string =>
  logCount === 0
    ? `Not logged in the last ${PALATE_WINDOW_DAYS} days`
    : `Logged once in the last ${PALATE_WINDOW_DAYS} days`;

/** The accessible name of a Not true button, which says which item it is on. */
export const describeNotTrue = (item: string): string => `Not true: ${item}`;

/** The body of the empty card, with the days logged so far. */
export const describeEmptyPalate = (loggedDays: number): string =>
  `Log your food on ${PALATE_USUAL_MIN_DAYS} days and this page shows what you usually eat. So far you have logged ${describeCount(loggedDays, "day", "days")}.`;

/** The accessible name of an Undo button, which says which item it is on. */
export const describeUndo = (item: string): string => `Undo, ${item}`;

/** The row that opens the rest of a list in place: "Show all 10". */
export const describeShowAll = (count: number): string => `Show all ${count}`;
