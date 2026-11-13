// The recipeSuggest set (KEY-1037, M9 plan section 8): "Suggest a dinner around 650 kcal with 45 g protein" through
// the real stack, with `ASSISTANT_KITCHEN=1` on the served functions (the workflow's `kitchen` input). It is opt in
// (`--set recipeSuggest`) at 90 %, because it makes one Opus call for each case.
//
// Every case is graded in code, never by a model. What a draft must satisfy: the numbers it shows equal core's
// `computeRecipe` over the real foods and the grams it shows, every matched line is a real food, the fit flag agrees with
// core's `isWithinTolerance`, none of the avoided foods appears, the Opus call left exactly one `recipe_generate`
// row, and no recipe was saved. These checks are all or nothing inside a case. "Would this person like it" is the judge's
// (`cases/palateJudge.ts`) and never decides a case here.
import { anyOfRoutes } from "./entryGraders.ts";
import {
  generationRows,
  generationRowsAtMost,
  lastTurnComplete,
  noAvoidedFood,
  noDraft,
  oneDraft,
  fitFlagIsTrue,
  modelToldTheDrawnFigures,
  recipeBookGuard,
  toolNotCalled,
  withinTolerance,
  answerMatches,
} from "./kitchenGraders.ts";
import {
  allLinesMatched,
  fitTargetIs,
  honestMiss,
  matchedLinesAreRealFoods,
  noMeatOrFish,
  shownNumbersEqualCore,
  suggestCalledWith,
  suggestRefusedWith,
  suggestWordsMatch,
  usesUsualFoods,
} from "./recipeSuggestGraders.ts";
import { palatePreferences, expectedPalateProfile } from "../fixtures/palateProfile.ts";
import { clarifyingQuestion } from "../src/case.ts";
import { kitchenWorldHolder } from "../src/kitchenWorld.ts";

import type { EvalCase, Grader } from "../src/case.ts";
import type { KitchenWorld } from "../src/kitchenWorld.ts";
import type { FitTarget } from "@keylow/core/recipes";

// What a draft must always satisfy, whatever the ask: the checks that need no knowledge of the case.
const draftIsSound = (unchanged: Grader): Grader[] => [
  lastTurnComplete(),
  oneDraft("suggestion"),
  matchedLinesAreRealFoods(),
  shownNumbersEqualCore(),
  modelToldTheDrawnFigures("suggest_recipe", "suggestion"),
  fitFlagIsTrue("suggestion"),
  noAvoidedFood(palatePreferences()),
  generationRows(1),
  unchanged,
];

const MISSED =
  /\b(close|closest|short|miss(?:ed)?|not (?:quite )?(?:reach|hit|get|there)|could ?n[o']t|cannot|can'?t|unable|over|under)\b/i;

type Ask = Readonly<{
  id: string;
  message: string;
  /** What the tool is called with, for the figures of one serving. */
  figures: Readonly<Record<string, number>>;
  target: FitTarget;
  /** Graders particular to the ask, on top of the sound-draft checks. */
  extra: (world: () => KitchenWorld) => Grader[];
  mustPass?: true;
}>;

const withinOrHonestMiss = (target: FitTarget): Grader =>
  anyOfRoutes([[withinTolerance("suggestion", target)], [honestMiss(target)]]);

const ASKS: readonly Ask[] = [
  {
    id: "recipe-suggest-650-45",
    message: "Suggest a dinner around 650 kcal with 45 g protein",
    figures: { kcal: 650, protein_g: 45 },
    target: { kcal: 650, protein_g: 45 },
    // The ticket's own case: it lands within the tolerance, and every ingredient resolves to a real food.
    extra: () => [
      withinTolerance("suggestion", { kcal: 650, protein_g: 45 }),
      fitTargetIs({ kcal: 650, protein_g: 45 }),
      allLinesMatched(),
    ],
    mustPass: true,
  },
  {
    id: "recipe-suggest-vegetarian",
    message: "Suggest a vegetarian lunch around 500 kcal with 30 g protein",
    figures: { kcal: 500, protein_g: 30 },
    target: { kcal: 500, protein_g: 30 },
    extra: () => [withinOrHonestMiss({ kcal: 500, protein_g: 30 }), noMeatOrFish()],
  },
  {
    id: "recipe-suggest-usual-foods",
    message: "Suggest a dinner around 600 kcal with 40 g protein, made from what I usually eat",
    figures: { kcal: 600, protein_g: 40 },
    target: { kcal: 600, protein_g: 40 },
    extra: (world) => [
      withinOrHonestMiss({ kcal: 600, protein_g: 40 }),
      usesUsualFoods(
        () => new Set(expectedPalateProfile(world().anchorDate).usualFoods.map(({ name }) => name)),
        2,
      ),
    ],
  },
  {
    id: "recipe-suggest-unreachable",
    // 80 g of protein is 320 kcal, more than the 300 kcal asked for, so no recipe can meet both.
    message: "Suggest a dinner around 300 kcal with 80 g protein",
    figures: { kcal: 300, protein_g: 80 },
    target: { kcal: 300, protein_g: 80 },
    extra: () => [
      honestMiss({ kcal: 300, protein_g: 80 }),
      answerMatches(MISSED, "says the recipe did not reach what was asked"),
    ],
    mustPass: true,
  },
  {
    id: "recipe-suggest-unmatched-lines-are-honest",
    message: "Suggest a dinner around 550 kcal with 40 g protein using dragon fruit and kangaroo",
    figures: { kcal: 550, protein_g: 40 },
    target: { kcal: 550, protein_g: 40 },
    // A line the foods do not hold is shown unmatched and left out of the figures. The sound-draft checks enforce that.
    extra: () => [],
  },
  {
    id: "recipe-suggest-with-carbs",
    message: "Suggest a dinner around 650 kcal, 45 g protein and 60 g carbs",
    figures: { kcal: 650, protein_g: 45, carbs_g: 60 },
    target: { kcal: 650, protein_g: 45, carbs_g: 60 },
    extra: () => [
      withinOrHonestMiss({ kcal: 650, protein_g: 45, carbs_g: 60 }),
      fitTargetIs({ kcal: 650, protein_g: 45, carbs_g: 60 }),
    ],
  },
  {
    id: "recipe-suggest-breakfast",
    message: "Suggest a breakfast around 400 kcal with 30 g protein",
    figures: { kcal: 400, protein_g: 30 },
    target: { kcal: 400, protein_g: 30 },
    extra: () => [withinOrHonestMiss({ kcal: 400, protein_g: 30 })],
  },
  {
    id: "recipe-suggest-quick-chicken",
    message: "Suggest a quick chicken dinner around 700 kcal with 50 g protein",
    figures: { kcal: 700, protein_g: 50 },
    target: { kcal: 700, protein_g: 50 },
    extra: () => [withinOrHonestMiss({ kcal: 700, protein_g: 50 }), suggestWordsMatch(/chicken/i)],
  },
];

const guardOf = (world: () => KitchenWorld) =>
  recipeBookGuard({
    ensureWorld: () => world().ensureWorld(),
    recipesFingerprint: () => world().recipesFingerprint(),
  });

export function createRecipeSuggestCases(world: () => KitchenWorld): EvalCase[] {
  const asked = ASKS.map((ask): EvalCase => {
    const { prepare, unchanged } = guardOf(world);
    return {
      id: ask.id,
      set: "recipeSuggest",
      prepare,
      messages: [ask.message],
      expect: [suggestCalledWith(ask.figures), ...draftIsSound(unchanged), ...ask.extra(world)],
      ...(ask.mustPass === true ? { mustPass: true as const } : {}),
    };
  });

  // The person asks for the foods they said they avoid. Either the assistant makes no recipe (with no call, or with the tool refusing after its Opus call), or the recipe it makes
  // holds none of them and is as sound as any other. Nothing is saved in either.
  const avoided = guardOf(world);
  const askedForAvoided: EvalCase = {
    id: "recipe-suggest-avoided-never-appears",
    set: "recipeSuggest",
    prepare: avoided.prepare,
    messages: [
      "Suggest a dinner around 600 kcal with 40 g protein that has peanuts and mushrooms in it",
    ],
    expect: [
      lastTurnComplete(),
      noAvoidedFood(palatePreferences()),
      avoided.unchanged,
      anyOfRoutes([
        [noDraft(), generationRows(0)],
        [
          noDraft(),
          generationRowsAtMost(1),
          suggestRefusedWith(["recipe_mentions_avoided", "nothing_matched"]),
        ],
        [
          oneDraft("suggestion"),
          matchedLinesAreRealFoods(),
          shownNumbersEqualCore(),
          generationRows(1),
        ],
      ]),
    ],
    mustPass: true,
  };

  // No figures given: the tool contract says to ask and never choose figures.
  const unasked = guardOf(world);
  const noFigures: EvalCase = {
    id: "recipe-suggest-asks-for-figures",
    set: "recipeSuggest",
    prepare: unasked.prepare,
    messages: ["Give me a dinner idea"],
    expect: [
      clarifyingQuestion(),
      toolNotCalled("suggest_recipe"),
      noDraft(),
      generationRows(0),
      unasked.unchanged,
    ],
  };
  return [...asked, askedForAvoided, noFigures];
}

export const recipeSuggestCases: readonly EvalCase[] = createRecipeSuggestCases(() =>
  kitchenWorldHolder.current(),
);
