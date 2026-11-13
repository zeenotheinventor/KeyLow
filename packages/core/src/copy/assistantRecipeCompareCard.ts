import { describeRecipeServings } from "./assistantRecipeCards";
import { formatCalories, formatGrams } from "../format/numbers";
import { MAX_RECIPE_NAME_LENGTH } from "../recipes/bounds";
import { FIT_TOLERANCE } from "../recipes/fit";

import type { FitNutrient } from "../recipes/fit";

/** The figures the person named, which a draft stores with a missing key or an undefined one alike. */
type NamedTargets = { [Nutrient in FitNutrient]?: number | undefined };

/*
 * The words of the compare card, from the approved boards `assistant-card · recipe-compare` and `-refused`
 * (docs/design/kitchen/proposals/kitchen-recipes.md, "Strings"). A string marked NOT ON THE CANVAS is a draft in
 * the board's style for a state the board does not draw, and waits for Zee's approval.
 */

export const RECIPE_COMPARE_WORDS = {
  perServing: "Per serving",
  before: "Before",
  after: "After",
  captions: { kcal: "kcal", protein_g: "Protein", carbs_g: "Carbs", fat_g: "Fat" },
  save: "Save as new recipe",
  changed: "Changed",
  /** NOT ON THE CANVAS: the board draws only changed and unchanged lines. */
  added: "Added",
  /** NOT ON THE CANVAS: the fitter never removes a line, and the stored shape allows it. */
  removed: "Removed",
  /** NOT ON THE CANVAS: what the card says when an item counted by portion stops the editor opening. */
  cannotSave: "This version can't be saved yet, because it has an item counted by portion.",
} as const;

const ADJUSTED_SUFFIX = ", adjusted";

/**
 * "Eval chicken and rice, adjusted": the card's title and the name the new recipe opens with. A name that
 * would pass the longest a recipe may have is cut before the suffix, so the suffix is never lost.
 */
export const describeAdjustedRecipeName = (name: string): string =>
  `${name.slice(0, MAX_RECIPE_NAME_LENGTH - ADJUSTED_SUFFIX.length)}${ADJUSTED_SUFFIX}`;

const CHANGE_NOUNS = { protein_g: "protein", carbs_g: "carbs", fat_g: "fat" } as const;

/**
 * "30 g more protein a serving", from the difference between what a serving came to and what it was asked to
 * be. A negative difference is "less". Calories read "150 kcal less a serving".
 */
export const describeRecipeCompareChange = (nutrient: FitNutrient, difference: number): string => {
  const direction = difference < 0 ? "less" : "more";
  return nutrient === "kcal"
    ? `${formatCalories(Math.abs(difference))} kcal ${direction} a serving`
    : `${formatGrams(Math.abs(difference))} g ${direction} ${CHANGE_NOUNS[nutrient]} a serving`;
};

/** "30 g more protein a serving · 2 servings · Not saved yet", and "Saved to your recipes" once it is. */
export const describeRecipeCompareSubtitle = (
  change: string | null,
  servings: number,
  isSaved: boolean,
): string =>
  [
    ...(change === null ? [] : [change]),
    describeRecipeServings(servings),
    isSaved ? "Saved to your recipes" : "Not saved yet",
  ].join(" · ");

/**
 * "Protein within 5 g of 79 g, calories within 5 % of 518 kcal": the tolerance of each target the person named,
 * which is the fitter's own (`FIT_TOLERANCE`), protein first and the calories last. Carbs and fat come in only
 * when named. Null when no figure was named, so "within" is never shown with nothing after it.
 */
export const describeRecipeCompareFitWithin = (target: NamedTargets): string | null => {
  const clauses = [
    ...(["protein_g", "carbs_g", "fat_g"] as const).flatMap((nutrient) => {
      const wanted = target[nutrient];
      const grams =
        nutrient === "protein_g" ? FIT_TOLERANCE.proteinGrams : FIT_TOLERANCE.macroGrams;
      return wanted === undefined
        ? []
        : [`${CHANGE_NOUNS[nutrient]} within ${grams} g of ${formatGrams(wanted)} g`];
    }),
    ...(target.kcal === undefined
      ? []
      : [`calories within ${FIT_TOLERANCE.kcalPercent} % of ${formatCalories(target.kcal)} kcal`]),
  ];
  const sentence = clauses.join(", ");
  return sentence === "" ? null : `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
};

type CompareAmounts = {
  change: "same" | "changed" | "added" | "removed";
  before: number | null;
  grams: number;
};

/**
 * What a line's detail says: "260 g → 455 g" for a changed line and "160 g, unchanged" for the rest, as the board
 * draws them. NOT ON THE CANVAS: a line counted by portion reads "Counted by portion, unchanged", an added food reads "120 g added, not in the method" (the steps are the
 * recipe's own and do not mention it, and a recipe with no steps has no method to be absent from), and a
 * removed one "30 g, removed".
 */
export const describeRecipeCompareAmounts = (
  { change, before, grams }: CompareAmounts,
  hasSteps: boolean,
): string => {
  switch (change) {
    case "same":
      // A food counted by portion has no weight to print, and the fitter leaves it as it is.
      return grams === 0 ? "Counted by portion, unchanged" : `${formatGrams(grams)} g, unchanged`;
    case "added":
      return `${formatGrams(grams)} g added${hasSteps ? ", not in the method" : ""}`;
    case "removed":
      return `${formatGrams(before ?? 0)} g, removed`;
    case "changed":
      return before === null
        ? `${formatGrams(grams)} g`
        : `${formatGrams(before)} g → ${formatGrams(grams)} g`;
  }
};

/** "Eval chicken and rice stays as it is.", under Save as new recipe. */
export const describeRecipeCompareStays = (name: string): string => `${name} stays as it is.`;
