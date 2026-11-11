// The meal estimate set (KEY-966): a person describes a meal and gives no grams, and the assistant works the amounts
// out with `estimate_portions` and logs them with `estimated` true, so the card says Estimate and the diary holds the
// macros. It is its own set, at 80 %, so it can be dispatched alone (the eval workflow has a 300,000 token budget for a
// run, which the other sets already fill).
//
// Every case is graded by the arguments of the calls and by what the database holds. The one grader that reads the
// reply looks for the words the rules ask for ("about", the name of the dish that was swapped), because the rule is
// about the words. A food is named by its CoFID code and checked against the database, as in the describe set.
import { DIARY_READ_TOOLS } from "./ask.ts";
import {
  actionRows,
  anyOfRoutes,
  answerSaysAbout,
  askedOnce,
  loggedItems,
  loggedRows,
  noActionRowsInTurn,
  onlyFoodsOf,
  onlyTheseTools,
  turnEnded,
  undoWrites,
  withContext,
} from "./entryGraders.ts";
import {
  askedAboutSharesInTurn,
  estimatePortionsNotCalled,
  estimateBadgeRows,
  estimatedContainerOnce,
  estimatedRows,
  loggedEstimatedAmounts,
  namesTheSubstitution,
  neverEstimated,
  neverQuick,
  noEstimateBadge,
  noInventedMacros,
  noMadeUpFigures,
  noQuestionInTurn,
  sizedWithEstimatePortions,
  turnLoggedOnlyFoods,
} from "./mealEstimateGraders.ts";
import { FOOD_ROUTES } from "../fixtures/describeExtras.ts";

import type { ExpectedItem } from "./entryGraders.ts";
import type { ExpectedContainer, SizedItem } from "./mealEstimateGraders.ts";
import type { EvalCase, Grader } from "../src/case.ts";

/** Zee's message of 2026-11-11, word for word (KEY-966). */
export const ZEES_LUNCH =
  "For lunch I ate a plate of food that had carrots, lettuce, a beef massaman, with rice, a brotchen (German roll) and one of those small butter packs you get at restaurants. With a small bowl of spinach soup. I know the spinach soup was about 100 calories. Finally for dessert a small bowl of apple crumble for 168 calories. I don't know the macros. Figure out the macros and log this meal.";
export const ZEES_SHARES = "rice 30%, massaman 30%, carrots 15%, lettuce 15%";

const RICE_ON_A_PLATE = [...FOOD_ROUTES.whiteRice, "11-867", "11-869"] as const;
// Old raw carrots have portions in the seed, so they are not a route of the describe set, and are right here.
const CARROTS_ON_A_PLATE = [...FOOD_ROUTES.carrots, "13-496"] as const;

// The plate of the message, sized by the shares the person answers with, with no size said: the default plate.
const PLATE: ExpectedContainer = { names: ["plate"], diameterCm: null };
const plateItems: readonly SizedItem[] = [
  { codes: RICE_ON_A_PLATE, share: 30 },
  { codes: FOOD_ROUTES.beefCurry, share: 30 },
  { codes: CARROTS_ON_A_PLATE, share: 15 },
  { codes: FOOD_ROUTES.lettuce, share: 15 },
];
// "About 100 calories" and "168 calories" are the person's figures. A soup is any CoFID soup the seed holds.
const SOUPS = [...FOOD_ROUTES.vegetableSoup, ...FOOD_ROUTES.tomatoSoup] as const;
const calorieItems: readonly SizedItem[] = [
  { codes: SOUPS, kcal: 100 },
  { codes: FOOD_ROUTES.appleCrumble, kcal: 168 },
];
// The roll and the butter are counted things, logged by a portion the food has.
const portionItems = (): ExpectedItem[] => [
  { codes: FOOD_ROUTES.crustyRoll, amount: { portion: true }, time: "any" },
  { codes: FOOD_ROUTES.butter, amount: { portion: true }, time: "any" },
];

const ALL_CODES = [
  ...RICE_ON_A_PLATE,
  ...FOOD_ROUTES.beefCurry,
  ...CARROTS_ON_A_PLATE,
  ...FOOD_ROUTES.lettuce,
  ...SOUPS,
  ...FOOD_ROUTES.appleCrumble,
  ...FOOD_ROUTES.crustyRoll,
  ...FOOD_ROUTES.butter,
];

const ESTIMATE_AND_READ_TOOLS: ReadonlySet<string> = new Set([
  ...DIARY_READ_TOOLS,
  "log_entry",
  "estimate_portions",
]);

// Turn 1 passes with one question about the shares and nothing written, or with everything the shares do not cover
// logged and the same one question. Neither writes a food of the plate before its share is known.
const firstTurnRoutes = (): Grader[] => [
  anyOfRoutes([
    [turnEnded(0, "clarify"), askedAboutSharesInTurn(0), noActionRowsInTurn(0)],
    [
      turnEnded(0, "clarify"),
      askedAboutSharesInTurn(0),
      turnLoggedOnlyFoods(0, [
        ...SOUPS,
        ...FOOD_ROUTES.appleCrumble,
        ...FOOD_ROUTES.crustyRoll,
        ...FOOD_ROUTES.butter,
      ]),
    ],
  ]),
];

function zeesLunch(today: string): EvalCase {
  const estimated: readonly SizedItem[] = [...plateItems, ...calorieItems];
  return {
    id: "meal-estimate-zees-lunch",
    set: "mealEstimate",
    messages: [ZEES_LUNCH, ZEES_SHARES],
    expect: [
      ...firstTurnRoutes(),
      turnEnded(1, "complete"),
      noQuestionInTurn(1),
      askedOnce(),
      sizedWithEstimatePortions(plateItems, PLATE),
      estimatedContainerOnce(PLATE.names),
      sizedWithEstimatePortions(calorieItems),
      loggedEstimatedAmounts(estimated, today, true),
      estimatedRows(estimated, today),
      loggedItems(portionItems(), today),
      loggedRows(portionItems(), today),
      neverQuick(),
      onlyFoodsOf(ALL_CODES),
      actionRows("log_entry", 8),
      estimateBadgeRows(estimated.length),
      answerSaysAbout(),
      namesTheSubstitution("massaman"),
      onlyTheseTools(ESTIMATE_AND_READ_TOOLS),
    ].map((grade) => withContext(grade, [ZEES_LUNCH, ZEES_SHARES])),
    cleanUp: undoWrites,
  };
}

function tomatoSoup(today: string): EvalCase {
  const message = "I had a small bowl of tomato soup, about 120 calories.";
  const soup: readonly SizedItem[] = [{ codes: FOOD_ROUTES.tomatoSoup, kcal: 120 }];
  return {
    id: "meal-estimate-tomato-soup-by-calories",
    set: "mealEstimate",
    messages: [message],
    expect: [
      turnEnded(0, "complete"),
      noQuestionInTurn(0),
      sizedWithEstimatePortions(soup),
      loggedEstimatedAmounts(soup, today),
      estimatedRows(soup, today),
      neverQuick(),
      actionRows("log_entry", 1),
      estimateBadgeRows(1),
      answerSaysAbout(),
      onlyTheseTools(ESTIMATE_AND_READ_TOOLS),
    ].map((grade) => withContext(grade, [message])),
    cleanUp: undoWrites,
  };
}

function fishAndChipsOnAThirtyCentimetrePlate(today: string): EvalCase {
  const message = "I had fish and chips on a 30 cm plate, half chips and half fish.";
  const container: ExpectedContainer = { names: ["plate", "large_plate"], diameterCm: 30 };
  const items: readonly SizedItem[] = [
    { codes: FOOD_ROUTES.chips, share: 50 },
    { codes: [...FOOD_ROUTES.batteredFish, "16-372", "16-373"], share: 50 },
  ];
  return {
    id: "meal-estimate-fish-and-chips-on-a-30-cm-plate",
    set: "mealEstimate",
    messages: [message],
    expect: [
      turnEnded(0, "complete"),
      noQuestionInTurn(0),
      sizedWithEstimatePortions(items, container),
      loggedEstimatedAmounts(items, today),
      estimatedRows(items, today),
      neverQuick(),
      actionRows("log_entry", 2),
      estimateBadgeRows(2),
      answerSaysAbout(),
      onlyTheseTools(ESTIMATE_AND_READ_TOOLS),
    ].map((grade) => withContext(grade, [message])),
    cleanUp: undoWrites,
  };
}

function gramsTheyGave(today: string): EvalCase {
  const message = "I had 150 g of boiled basmati rice.";
  const rice: readonly ExpectedItem[] = [{ codes: FOOD_ROUTES.whiteRice, amount: { grams: 150 } }];
  return {
    id: "meal-estimate-grams-are-not-estimated",
    set: "mealEstimate",
    messages: [message],
    expect: [
      turnEnded(0, "complete"),
      noQuestionInTurn(0),
      loggedItems(rice, today),
      loggedRows(rice, today),
      estimatePortionsNotCalled(),
      neverEstimated(),
      noEstimateBadge(),
      actionRows("log_entry", 1),
      onlyTheseTools(ESTIMATE_AND_READ_TOOLS),
    ].map((grade) => withContext(grade, [message])),
    cleanUp: undoWrites,
  };
}

function madeUpMacros(): EvalCase {
  const message = "Just make up the macros for my curry.";
  return {
    id: "meal-estimate-redteam-make-up-the-macros",
    set: "mealEstimate",
    messages: [message],
    expect: [noInventedMacros(), noMadeUpFigures(), onlyTheseTools(ESTIMATE_AND_READ_TOOLS)].map(
      (grade) => withContext(grade, [message]),
    ),
    cleanUp: undoWrites,
  };
}

/** The cases of the set for a run whose today is `anchorDate`. */
export function mealEstimateCasesOf(anchorDate: string): readonly EvalCase[] {
  return [
    zeesLunch(anchorDate),
    tomatoSoup(anchorDate),
    fishAndChipsOnAThirtyCentimetrePlate(anchorDate),
    gramsTheyGave(anchorDate),
    madeUpMacros(),
  ];
}

/** The set for a run now: the eval user's today is the UTC date, as the describe set takes it. */
export const mealEstimateCases: readonly EvalCase[] = mealEstimateCasesOf(
  new Date().toISOString().slice(0, 10),
);
