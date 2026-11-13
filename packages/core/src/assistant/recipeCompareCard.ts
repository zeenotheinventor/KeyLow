import {
  RECIPE_COMPARE_WORDS,
  describeAdjustedRecipeName,
  describeRecipeCompareAmounts,
  describeRecipeCompareChange,
  describeRecipeCompareFitWithin,
  describeRecipeCompareStays,
  describeRecipeCompareSubtitle,
} from "../copy/assistantRecipeCompareCard";
import { describeRecipeDraftMiss } from "../copy/assistantRecipeDraftCard";
import { formatCalories, formatGrams } from "../format/numbers";

import type { AdjustmentDraft } from "./adjustmentDraft";
import type { FitNutrient } from "../recipes/fit";

/** One row of the Per serving table: the figure before the change and after it. */
export type RecipeCompareCardFigure = {
  nutrient: FitNutrient;
  caption: string;
  before: string;
  after: string;
};

export type RecipeCompareCardRow = {
  /** The food's own name, as the recipe holds it. */
  name: string;
  /** "260 g → 455 g", "160 g, unchanged" and the like. */
  detail: string;
  /** "Changed" or "Added" on a line that is not as it was, else null. */
  badge: string | null;
};

/** What the compare card prints, every word and figure worded and formatted. The card holds no branch of its own. */
export type RecipeCompareCard = {
  title: string;
  subtitle: string;
  figuresLabel: string;
  beforeLabel: string;
  afterLabel: string;
  figures: RecipeCompareCardFigure[];
  /** Null when the draft has no fit. */
  fit: { tone: "success" | "warning"; text: string } | null;
  rows: RecipeCompareCardRow[];
  /** "Eval chicken and rice stays as it is.", under the one action. */
  originalStays: string;
};

const FIGURE_ORDER: readonly FitNutrient[] = ["kcal", "protein_g", "carbs_g", "fat_g"];
const CHANGE_ORDER: readonly FitNutrient[] = ["protein_g", "carbs_g", "fat_g", "kcal"];

const figureValueOf = (nutrient: FitNutrient, amount: number): string =>
  nutrient === "kcal" ? formatCalories(amount) : `${formatGrams(amount)} g`;

// What the person asked to change: the first figure whose target is a whole unit away from what a serving was.
// `adjustmentTarget` moves one figure and holds the calories, so at most one of them differs.
const changeOf = (draft: AdjustmentDraft): string | null => {
  for (const nutrient of CHANGE_ORDER) {
    const wanted = draft.fit?.target[nutrient];
    const was = draft.before[nutrient];
    if (wanted !== undefined && was !== null && Math.round(wanted - was) !== 0) {
      return describeRecipeCompareChange(nutrient, wanted - was);
    }
  }
  return null;
};

const fitLineOf = (draft: AdjustmentDraft): RecipeCompareCard["fit"] => {
  if (draft.fit === null) {
    return null;
  }
  if (draft.fit.status === "within") {
    const text = describeRecipeCompareFitWithin(draft.fit.target);
    return text === null ? null : { tone: "success", text };
  }
  return draft.fit.misses.length === 0
    ? null
    : { tone: "warning", text: draft.fit.misses.map(describeRecipeDraftMiss).join(" ") };
};

const badgeOf = (change: AdjustmentDraft["ingredients"][number]["change"]): string | null =>
  ({
    same: null,
    changed: RECIPE_COMPARE_WORDS.changed,
    added: RECIPE_COMPARE_WORDS.added,
    removed: RECIPE_COMPARE_WORDS.removed,
  })[change];

/**
 * What the compare card prints for an adjustment (`assistant-card · recipe-compare`). The figures are the
 * draft's own, which core computed, and the card only words them. A figure that has no data on either side is
 * left out of the table and never printed as 0.
 */
export function describeRecipeCompareCard(
  draft: AdjustmentDraft,
  { isSaved }: { isSaved: boolean },
): RecipeCompareCard {
  const figures = FIGURE_ORDER.flatMap((nutrient): RecipeCompareCardFigure[] => {
    const before = draft.before[nutrient];
    const after = draft.perServing[nutrient];
    return before === null || after === null
      ? []
      : [
          {
            nutrient,
            caption: RECIPE_COMPARE_WORDS.captions[nutrient],
            before: figureValueOf(nutrient, before),
            after: figureValueOf(nutrient, after),
          },
        ];
  });
  const hasSteps = draft.steps.length > 0;

  return {
    title: describeAdjustedRecipeName(draft.name),
    subtitle: describeRecipeCompareSubtitle(changeOf(draft), draft.servings, isSaved),
    figuresLabel: RECIPE_COMPARE_WORDS.perServing,
    beforeLabel: RECIPE_COMPARE_WORDS.before,
    afterLabel: RECIPE_COMPARE_WORDS.after,
    figures,
    fit: fitLineOf(draft),
    rows: draft.ingredients.map((ingredient) => ({
      name: ingredient.foodName ?? ingredient.name,
      detail: describeRecipeCompareAmounts(
        { change: ingredient.change, before: ingredient.beforeGrams, grams: ingredient.grams },
        hasSteps,
      ),
      badge: badgeOf(ingredient.change),
    })),
    originalStays: describeRecipeCompareStays(draft.name),
  };
}
