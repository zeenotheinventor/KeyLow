import { describePlanMiss } from "./assistantPlanCards";
import { describeDateRange, describeShortDate, joinInWords } from "./bodyMap";
import { describeDateInWords } from "./diary";
import { formatCalories, formatGrams } from "../format/numbers";
import { formatScaledCount } from "../format/scaledCount";
import { MEAL_PLAN_DEFAULT_REPEAT_LIMIT } from "../plans/constants";
import { FIT_TOLERANCE } from "../recipes/fit/fitTolerance";

import type { PlanBand } from "../plans/types";

/*
 * The words of the Plan screens, from the approved boards of `docs/design/kitchen/proposals/kitchen-plan.md`:
 * `diary · plan-entry`, `plan · week`, `plan · day`, `plan · day-confirmed`, `plan · day-short`, `plan · empty`,
 * `plan · settings` and `plan · first-plan-variety`. Every figure is core's sum, written here and never typed
 * by a model.
 */

export const MEAL_PLAN_WORDS = {
  title: "Meal plan",
  back: "Back",
  settingsLabel: "Plan settings",
  planned: "Planned",
  loggedFromPlan: "Logged from the plan",
  confirmDay: "Confirm day",
  regenerateDay: "Regenerate day",
  statusConfirmed: "Confirmed",
  statusWithin: "Within target",
  statusShort: "Short",
  // NOT ON THE CANVAS. No board draws a day with nothing planned, so these two words are the engineer's until one does.
  statusEmpty: "Nothing planned",
  emptyDayCaption: "Nothing is planned for this day.",
  stripConfirmed: "confirmed",
  stripShort: "short",
  recipeFallbackName: "Recipe",
  foodFallbackName: "Food",
  today: "Today",
  confirmedBannerTitle: "Confirmed",
  openInDiary: "Open in diary",
  confirmedFooter: "Confirmed days stay as they are. Edit the entries in your diary.",
  inDiaryTick: "In your diary",
  leftover: "Leftover",
  loadFailedTitle: "Couldn't load your meal plan",
  loadFailedBody: "Check your connection and try again.",
  dayNotFoundTitle: "That day is not in your meal plan",
  confirmFailed: "Couldn't confirm this day. Try again.",
  emptyTitle: "No meal plan yet",
  emptyBody:
    "The assistant can plan a week from your recipes and the foods you usually log, to your targets for each day.",
  emptyAction: "Plan my week",
} as const;

export const MEAL_PLAN_BAND_NAMES: Readonly<Record<PlanBand, string>> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
};

/** The Diary's More sheet item that opens the Plan screen. */
export const DIARY_PLAN_ITEM = {
  label: "Meal plan",
  caption: "Plan your week from your recipes and foods",
} as const;

const countOf = (count: number, one: string, many: string): string =>
  `${formatScaledCount(count)} ${count === 1 ? one : many}`;

const timesAWeek = (limit: number): string =>
  limit === 1 ? "once a week" : limit === 2 ? "twice a week" : `${limit} times a week`;

/** The Diary's plan row title: "Planned for today", or "Planned for Thu 19 Nov" on another day. */
export const describePlanRowTitle = (localDate: string, isToday: boolean): string =>
  isToday ? "Planned for today" : `Planned for ${describeShortDate(localDate)}`;

/** The Diary's plan row caption: "3 meals · 1,294 kcal · P 93 g · not confirmed". A figure the plan has no value for is left out. */
export const describePlanRowCaption = (input: {
  mealCount: number;
  kcal: number | null;
  protein: number | null;
}): string =>
  [
    countOf(input.mealCount, "meal", "meals"),
    ...(input.kcal === null ? [] : [`${formatCalories(input.kcal)} kcal`]),
    ...(input.protein === null ? [] : [`P ${formatGrams(input.protein)} g`]),
    "not confirmed",
  ].join(" · ");

/** The week header's range, and the name of a plan day's subtitle: "Meal plan · Mon 16 to Sun 22 Nov". */
export const describePlanDaySubtitle = (start: string, end: string): string =>
  `${MEAL_PLAN_WORDS.title} · ${describeDateRange(start, end)}`;

/** A day card's title, "Monday 16": the weekday and the day of the month. */
export const describePlanDayTitle = (localDate: string): string =>
  describeDateInWords(localDate).split(" ").slice(0, 2).join(" ");

type Figures = { kcal: number | null; protein_g: number | null };

/**
 * A day's figures against its target: "1,296 of 1,300 kcal · P 86 of 90 g". A figure with no target is said
 * on its own, and a figure the plan has no value for is left out.
 */
export const describePlanDayTotals = (totals: Figures, target: Figures): string => {
  const parts: string[] = [];
  if (totals.kcal !== null) {
    parts.push(
      target.kcal === null
        ? `${formatCalories(totals.kcal)} kcal`
        : `${formatCalories(totals.kcal)} of ${formatCalories(target.kcal)} kcal`,
    );
  }
  if (totals.protein_g !== null) {
    parts.push(
      target.protein_g === null
        ? `P ${formatGrams(totals.protein_g)} g`
        : `P ${formatGrams(totals.protein_g)} of ${formatGrams(target.protein_g)} g`,
    );
  }
  return parts.join(" · ");
};

/** A band's total on its heading line: "389 kcal · P 13 g". */
export const describePlanBandFigures = (totals: Figures): string =>
  [
    ...(totals.kcal === null ? [] : [`${formatCalories(totals.kcal)} kcal`]),
    ...(totals.protein_g === null ? [] : [`P ${formatGrams(totals.protein_g)} g`]),
  ].join(" · ");

/** The tolerance line under the totals: "Within 5 % of 1,300 kcal and 5 g of 90 g protein." Only the figures the day has a target for are named. */
export const describePlanTolerance = (target: Figures): string | null => {
  const parts = [
    ...(target.kcal === null
      ? []
      : [`${FIT_TOLERANCE.kcalPercent} % of ${formatCalories(target.kcal)} kcal`]),
    ...(target.protein_g === null
      ? []
      : [`${FIT_TOLERANCE.proteinGrams} g of ${formatGrams(target.protein_g)} g protein`]),
  ];
  return parts.length === 0 ? null : `Within ${parts.join(" and ")}.`;
};

/** The caption over Confirm day: "Confirm day adds these 8 items to your diary at their times." */
export const describePlanConfirmCaption = (itemCount: number): string =>
  itemCount === 1
    ? "Confirm day adds this item to your diary at its time."
    : `Confirm day adds these ${formatScaledCount(itemCount)} items to your diary at their times.`;

/** The banner of a confirmed day: "5 entries are in your diary. Change them there." */
export const describePlanConfirmedBody = (entryCount: number): string =>
  entryCount === 1
    ? "1 entry is in your diary. Change it there."
    : `${formatScaledCount(entryCount)} entries are in your diary. Change them there.`;

/** What a day's item count reads as in the week: "5 items". */
export const describePlanItemCount = (itemCount: number): string =>
  countOf(itemCount, "item", "items");

/** The badge of a recipe that leaves servings for later days: "Makes 2, 1 for tomorrow", or "Makes 3, 2 for later". */
export const describePlanCookBadge = (input: {
  servingsMade: number;
  leftoverCount: number;
  isForTomorrow: boolean;
}): string =>
  `Makes ${formatScaledCount(input.servingsMade)}, ${formatScaledCount(input.leftoverCount)} for ${
    input.isForTomorrow ? "tomorrow" : "later"
  }`;

type Miss = {
  nutrient: "kcal" | "protein_g" | "carbs_g" | "fat_g";
  target: number;
  achieved: number | null;
};

const figureOf = (nutrient: Miss["nutrient"], value: number): string =>
  nutrient === "kcal" ? `${formatCalories(value)} kcal` : `${formatGrams(value)} g`;

/** The title of the short day banner: "22 g short on protein", or "22 g short on protein and 180 kcal under". */
export const describePlanShortTitle = (misses: readonly Miss[]): string => {
  const text = joinInWords(misses.map(describePlanMiss));
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const WITHIN_WORDS: Record<Miss["nutrient"], string> = {
  kcal: `calories within ${FIT_TOLERANCE.kcalPercent} %`,
  protein_g: `protein within ${FIT_TOLERANCE.proteinGrams} g`,
  carbs_g: `carbs within ${FIT_TOLERANCE.macroGrams} g`,
  fat_g: `fat within ${FIT_TOLERANCE.macroGrams} g`,
};

/**
 * The body of the short day banner: "The closest the plan gets is 68 g of 90 g, with calories within 5 %.
 * Confirm it as it is, or regenerate the day with other words." `judged` names the nutrients the day has a
 * target for, so only a nutrient that is judged and met is said to be within.
 */
export const describePlanShortBody = (
  misses: readonly Miss[],
  judged: readonly Miss["nutrient"][],
): string => {
  const closest = misses
    .filter((miss): miss is Miss & { achieved: number } => miss.achieved !== null)
    .map(
      ({ nutrient, achieved, target }) =>
        `${figureOf(nutrient, achieved)} of ${figureOf(nutrient, target)}`,
    );
  const missed = new Set(misses.map(({ nutrient }) => nutrient));
  const within = judged
    .filter((nutrient) => !missed.has(nutrient))
    .map((nutrient) => WITHIN_WORDS[nutrient]);
  const lead =
    closest.length === 0
      ? ""
      : `The closest the plan gets is ${joinInWords(closest)}${within.length === 0 ? "" : `, with ${joinInWords(within)}`}. `;
  return `${lead}Confirm it as it is, or regenerate the day with other words.`;
};

/** What "Regenerate day" puts in the assistant's composer, for the person to finish: "Replan Wed 18 Nov: ". */
export const describeReplanPrefill = (localDate: string): string =>
  `Replan ${describeShortDate(localDate)}: `;

/** What "Plan my week" puts in the composer: "Plan my meals for Wed 18 to Sun 22 Nov". */
export const describePlanPrefill = (start: string, end: string): string =>
  `Plan my meals for ${describeDateRange(start, end)}`;

/** The plan settings screen: the question, its hint and the answers, as `plan · settings` draws them. */
export const PLAN_SETTINGS_WORDS = {
  title: "Plan settings",
  question: "How often can a recipe repeat?",
  hint: "In one week. Leftovers count toward the limit, so a recipe that makes 2 servings uses 2.",
  noLimitDescription: "You don't mind eating the same thing again and again.",
  startingLimit: "Starting limit",
  caption:
    "A new limit applies to your next plan and to any day you regenerate. Days already planned stay as they are.",
  saved: "Repeat limit saved",
  saveFailed: "Couldn't save the repeat limit. Try again.",
  loadFailedTitle: "Couldn't load your repeat limit",
  loadFailedBody: "Check your connection and try again.",
} as const;

const TIMES_TITLES = [
  "Once a week",
  "Twice a week",
  "3 times a week",
  "4 times a week",
  "5 times a week",
  "6 times a week",
  "7 times a week",
] as const;

/** One answer of the repeat limit question: the number the profile stores (0 is no limit), and its title. */
export type RepeatLimitChoice = {
  value: number;
  title: string;
  description?: string;
};

/** The eight answers, once a week to seven times a week and then No limit, as the board lists them. */
export const REPEAT_LIMIT_CHOICES: readonly RepeatLimitChoice[] = [
  ...TIMES_TITLES.map((title, index) => ({ value: index + 1, title })),
  { value: 0, title: "No limit", description: PLAN_SETTINGS_WORDS.noLimitDescription },
];

/** The first plan's banner, shown while the person has not chosen a limit: "Recipes repeat up to twice a week". */
export const FIRST_PLAN_VARIETY_WORDS = {
  title: `Recipes repeat up to ${timesAWeek(MEAL_PLAN_DEFAULT_REPEAT_LIMIT)}`,
  body: "Leftovers count as a repeat. This is the starting limit until you choose your own.",
  action: "Change",
} as const;

/**
 * The add screen for a plan (`plan · shopping-added`). The line says what is counted. The buttons, the groups
 * and the toast are the shopping list's own words (`SHOPPING_LIST`).
 */
export const PLAN_SHOPPING_WORDS = {
  scopeLine:
    "The days not yet confirmed. A recipe is bought once for the servings it makes, so leftovers are not bought twice.",
  // NOT ON THE CANVAS. No board draws a plan with nothing to buy, so these words are the engineer's until one does.
  nothingToBuy: "Every day here is confirmed or has nothing planned, so there is nothing to buy.",
} as const;
