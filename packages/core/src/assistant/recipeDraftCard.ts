import { IMPORT_LINE_NOT_COUNTED } from "../copy/assistantRecipeCards";
import {
  RECIPE_DRAFT_WORDS,
  describeRecipeDraftAsked,
  describeRecipeDraftFitWithin,
  describeRecipeDraftMiss,
  describeRecipeDraftSteps,
  describeRecipeDraftSubtitle,
} from "../copy/assistantRecipeDraftCard";
import { describeFoodSource } from "../copy/foodSources";
import { formatCalories, formatGrams } from "../format/numbers";

import type { AssistantRecipeDraft } from "./recipeDraft";
import type { FitNutrient } from "../recipes/fit";

type DraftIngredient = AssistantRecipeDraft["ingredients"][number];

/** One figure of the Per serving strip. `asked` is under it when the person named it, and `isMiss` turns it to the warning ink. */
export type RecipeDraftCardFigure = {
  nutrient: FitNutrient;
  caption: string;
  value: string;
  asked: string | null;
  isMiss: boolean;
};

export type RecipeDraftCardRow = {
  /** "220 g chicken breast". */
  name: string;
  /** The matched food with its source, or the words that an unmatched line is not counted. */
  detail: string;
  /** The line's kcal for the whole recipe, null when it has none. */
  value: string | null;
  /** "Not matched" on a line that matched no food, which is left out of the numbers, else null. */
  notMatchedBadge: string | null;
};

/** What the suggested recipe card prints, every word and figure worded and formatted. The card holds no branch of its own. */
export type RecipeDraftCard = {
  title: string;
  subtitle: string;
  figuresLabel: string;
  figures: RecipeDraftCardFigure[];
  /** Null when the person named no figure to fit. */
  fit: { tone: "success" | "warning"; text: string } | null;
  rows: RecipeDraftCardRow[];
  /** Null for a draft with no steps. The steps are numbered, and the row is closed until pressed. */
  instructions: { title: string; summary: string; steps: string[] } | null;
};

const FIGURE_ORDER: readonly FitNutrient[] = ["kcal", "protein_g", "carbs_g", "fat_g"];

const figureValueOf = (nutrient: FitNutrient, amount: number): string =>
  nutrient === "kcal" ? formatCalories(amount) : `${formatGrams(amount)} g`;

const rowOf = (ingredient: DraftIngredient): RecipeDraftCardRow => {
  const name = `${formatGrams(ingredient.grams)} g ${ingredient.name}`;
  if (ingredient.foodId === null || ingredient.foodName === null) {
    return {
      name,
      detail: IMPORT_LINE_NOT_COUNTED,
      value: null,
      notMatchedBadge: RECIPE_DRAFT_WORDS.notMatched,
    };
  }
  const source = ingredient.foodSource;
  return {
    name,
    detail:
      source === null || source === undefined
        ? ingredient.foodName
        : `${ingredient.foodName} · ${describeFoodSource(source)}`,
    value: ingredient.kcal === null ? null : `${formatCalories(ingredient.kcal)} kcal`,
    notMatchedBadge: null,
  };
};

const fitLineOf = (draft: AssistantRecipeDraft): RecipeDraftCard["fit"] => {
  if (draft.fit === null) {
    return null;
  }
  if (draft.fit.status === "within") {
    const leftOut = draft.ingredients
      .filter(({ foodId }) => foodId === null)
      .map(({ name }) => name);
    const text = describeRecipeDraftFitWithin(draft.fit.target, leftOut);
    return text === null ? null : { tone: "success", text };
  }
  return draft.fit.misses.length === 0
    ? null
    : { tone: "warning", text: draft.fit.misses.map(describeRecipeDraftMiss).join(" ") };
};

/**
 * What the suggested recipe card prints for a draft (`assistant-card · recipe-draft`, `-short`, `-unmatched` and
 * `-saved`). The figures are the draft's own, which core computed, and the card only words them. A figure the
 * foods have no data for is left out of the strip and never printed as 0.
 */
export function describeRecipeDraftCard(
  draft: AssistantRecipeDraft,
  { isSaved }: { isSaved: boolean },
): RecipeDraftCard {
  const missed = new Set((draft.fit?.misses ?? []).map(({ nutrient }) => nutrient));
  const figures = FIGURE_ORDER.flatMap((nutrient): RecipeDraftCardFigure[] => {
    const amount = draft.perServing[nutrient];
    if (amount === null) {
      return [];
    }
    const wanted = draft.fit?.target[nutrient];
    return [
      {
        nutrient,
        caption: RECIPE_DRAFT_WORDS.captions[nutrient],
        value: figureValueOf(nutrient, amount),
        asked: wanted === undefined ? null : describeRecipeDraftAsked(nutrient, wanted),
        isMiss: missed.has(nutrient),
      },
    ];
  });

  return {
    title: draft.name,
    subtitle: describeRecipeDraftSubtitle(draft.servings, isSaved),
    figuresLabel: RECIPE_DRAFT_WORDS.perServing,
    figures,
    fit: fitLineOf(draft),
    rows: draft.ingredients.map(rowOf),
    instructions:
      draft.steps.length === 0
        ? null
        : {
            title: RECIPE_DRAFT_WORDS.instructions,
            summary: describeRecipeDraftSteps(draft.steps.length),
            steps: draft.steps.map((step, index) => `${index + 1}. ${step}`),
          },
  };
}

/**
 * What tells one draft from another, so the sheet can remember that a draft was saved. The live turn's draft and
 * the stored one it becomes are the same draft, and have different ids, so the id is no use. It is kept in
 * memory only and is never written, logged or sent.
 */
export const recipeDraftKeyOf = (draft: AssistantRecipeDraft): string =>
  JSON.stringify([
    draft.variant,
    draft.name,
    draft.servings,
    draft.ingredients.map(({ foodId, name, grams }) => [foodId ?? name, grams]),
    draft.steps,
  ]);
