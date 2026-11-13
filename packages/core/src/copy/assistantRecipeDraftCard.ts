import { joinNames } from "./assistantEntryCards";
import { describeRecipeServings } from "./assistantRecipeCards";
import { formatCalories, formatGrams } from "../format/numbers";
import { FIT_TOLERANCE } from "../recipes/fit";

import type { FitMiss, FitNutrient } from "../recipes/fit";

/** The figures the person named, which a draft stores with a missing key or an undefined one alike. */
type NamedTargets = { [Nutrient in FitNutrient]?: number | undefined };

/*
 * The words of the suggested recipe card, from the approved boards `assistant-card · recipe-draft`, `-short`,
 * `-unmatched`, `-saved` and `-failed`, and `assistant · working-long` (docs/design/kitchen/proposals/
 * kitchen-recipes.md, "Strings"). A string marked NOT ON THE BOARD is a draft in the board's style where the
 * board's sentence needs a figure the draft does not carry, and waits for Zee's approval.
 */

export const RECIPE_DRAFT_WORDS = {
  perServing: "Per serving",
  captions: { kcal: "kcal", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" },
  instructions: "Instructions",
  save: "Save to recipes",
  adjust: "Adjust",
  saveFailed: "Not saved. Check your connection and try again.",
  notMatched: "Not matched",
} as const;

/** What Adjust puts in the composer, focused and not sent. The trailing space is the person's cue to go on typing. */
export const RECIPE_DRAFT_ADJUST_PREFILL = "Change this recipe: ";

/**
 * What Adjust leaves in the composer: the words for changing a recipe when it is empty, and what the person
 * already typed when it is not, so Adjust never throws their words away.
 */
export const composerTextForAdjust = (typed: string): string =>
  typed.trim() === "" ? RECIPE_DRAFT_ADJUST_PREFILL : typed;

/**
 * The second line of the working line while a recipe is written (`assistant · working-long`): it appears once
 * the tool has been working for `afterMilliseconds`. The threshold is a guess that the generation timings
 * should settle. The plans have their own words.
 */
export const RECIPE_WORKING_HINT = {
  words: "Recipes take longer, up to about 40 seconds.",
  afterMilliseconds: 8000,
  tools: ["suggest_recipe", "adjust_recipe"],
} as const;

/** "2 servings · Not saved yet", and "2 servings · Saved to your recipes". */
export const describeRecipeDraftSubtitle = (servings: number, isSaved: boolean): string =>
  `${describeRecipeServings(servings)} · ${isSaved ? "Saved to your recipes" : "Not saved yet"}`;

/** What the person asked a figure to be, under it in the strip: "Asked 600" for calories, "Asked 45 g" for the rest. */
export const describeRecipeDraftAsked = (nutrient: FitNutrient, target: number): string =>
  nutrient === "kcal" ? `Asked ${formatCalories(target)}` : `Asked ${formatGrams(target)} g`;

/** "4 steps", the closed Instructions row's second line. */
export const describeRecipeDraftSteps = (count: number): string =>
  count === 1 ? "1 step" : `${count} steps`;

const WITHIN_NOUNS = { protein_g: "protein", carbs_g: "carbs", fat_g: "fat" } as const;

/**
 * "Within 5 % of 600 kcal and 5 g of 45 g protein": the tolerance of each target the person named, which is
 * the fitter's own (`FIT_TOLERANCE`), calories by percent and the rest in grams. Carbs and fat come in only when
 * named. `leftOut` are the lines that are not in the numbers, which end it as ", without the harissa paste".
 * Null when no figure was named, so "Within" is never shown with nothing after it.
 */
export const describeRecipeDraftFitWithin = (
  target: NamedTargets,
  leftOut: readonly string[],
): string | null => {
  const clauses = [
    target.kcal === undefined
      ? null
      : `${FIT_TOLERANCE.kcalPercent} % of ${formatCalories(target.kcal)} kcal`,
    ...(["protein_g", "carbs_g", "fat_g"] as const).map((nutrient) => {
      const wanted = target[nutrient];
      const grams =
        nutrient === "protein_g" ? FIT_TOLERANCE.proteinGrams : FIT_TOLERANCE.macroGrams;
      return wanted === undefined
        ? null
        : `${grams} g of ${formatGrams(wanted)} g ${WITHIN_NOUNS[nutrient]}`;
    }),
  ].filter((clause): clause is string => clause !== null);
  if (clauses.length === 0) {
    return null;
  }
  const without =
    leftOut.length === 0 ? "" : `, without ${joinNames(leftOut.map((name) => `the ${name}`))}`;
  return `Within ${joinNames(clauses)}${without}`;
};

const MISS_WORDS: Record<FitNutrient, { subject: string; noun: string }> = {
  kcal: { subject: "Calories are", noun: "calorie" },
  protein_g: { subject: "Protein is", noun: "protein" },
  carbs_g: { subject: "Carbs are", noun: "carbs" },
  fat_g: { subject: "Fat is", noun: "fat" },
};

const figureOf = (nutrient: FitNutrient, amount: number): string =>
  nutrient === "kcal" ? `${formatCalories(amount)} kcal` : `${formatGrams(amount)} g`;

type RecipeDraftMiss = Pick<FitMiss, "nutrient" | "target" | "achieved" | "reason" | "limitedBy">;

/**
 * One target the draft does not meet, in plain words: how far off the figure is and what held it back.
 * NOT ON THE BOARD: the board's sentence also gives the calories the fit would reach, which the draft does
 * not carry, so this names the limiting ingredients, or says it is the closest fit when it has none (a
 * conflict between the targets has no limiting ingredient).
 */
export const describeRecipeDraftMiss = ({
  nutrient,
  target,
  achieved,
  reason,
  limitedBy,
}: RecipeDraftMiss): string => {
  const words = MISS_WORDS[nutrient];
  if (achieved === null) {
    const subject = words.subject.replace(/ (is|are)$/, "");
    return `${subject} could not be checked, because these foods have no ${words.noun} figure.`;
  }
  const gap = figureOf(nutrient, Math.abs(achieved - target));
  const direction = achieved < target ? "under" : "over";
  const opening = `${words.subject} ${gap} ${direction} the ${figureOf(nutrient, target)} you asked for.`;
  if (limitedBy.length > 0) {
    return `${opening} It is held back by ${joinNames(limitedBy.map((name) => `the ${name}`))}.`;
  }
  return reason === "targets_conflict"
    ? `${opening} The figures you asked for pull against each other, so this is the closest fit.`
    : `${opening} This is the closest fit these ingredients allow.`;
};
