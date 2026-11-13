import { figuresOf, per100Of } from "./draftNutrients";
import { avoidsFood } from "../palate";
import { buildRecipeIngredient, computeRecipe } from "../recipes";
import { fitRecipeToTargets } from "../recipes/fit";

import type { AssistantRecipeDraft } from "./recipeDraft";
import type { PalatePreference } from "../palate";
import type { RecipeIngredient } from "../recipes";
import type { FitMiss, FitTarget } from "../recipes/fit";
import type { Food, FoodPortion } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

export type SuggestionDraft = Extract<AssistantRecipeDraft, { variant: "suggestion" }>;

/** One line the model proposed, with the foods row it matched (null when it matched none) and that food's portions. */
export type SuggestionLine = {
  name: string;
  grams: number;
  food: Food | null;
  portions: readonly FoodPortion[];
};

export type SuggestionInput = {
  name: string;
  servings: number;
  steps: readonly string[];
  lines: readonly SuggestionLine[];
  /** What a serving should come to. An empty target is not fitted. */
  target: FitTarget;
  /** What the person avoids. A line that names an avoided food, or matched one, is dropped. */
  preferences: readonly PalatePreference[];
};

export type SuggestionOutcome =
  | { status: "drafted"; draft: SuggestionDraft }
  /** No line is left to count. `leftOutAvoided` names the lines dropped because the person avoids them. */
  | { status: "nothing_matched"; leftOutAvoided: string[] }
  /** The recipe's own name or a step names a food the person avoids, so it cannot be offered. */
  | { status: "mentions_avoided" };

type CountedLine = {
  line: SuggestionLine;
  food: Food;
  per100: NullableNutrients;
};

// The lines that share a food are fitted as one ingredient, since the fitter holds one amount for each food, and
// the fitted amount is shared back in the proportion they were proposed in.
type FoodGroup = {
  foodId: string;
  per100: NullableNutrients;
  lines: CountedLine[];
  proposedGrams: number;
};

const groupsOf = (counted: readonly CountedLine[]): FoodGroup[] => {
  const groups = new Map<string, FoodGroup>();
  for (const countedLine of counted) {
    const group = groups.get(countedLine.food.id) ?? {
      foodId: countedLine.food.id,
      per100: countedLine.per100,
      lines: [],
      proposedGrams: 0,
    };
    group.lines.push(countedLine);
    group.proposedGrams += countedLine.line.grams;
    groups.set(group.foodId, group);
  }
  return [...groups.values()];
};

const withLimitsNamed = (misses: readonly FitMiss[], groups: readonly FoodGroup[]) =>
  misses.map((miss) => ({
    ...miss,
    limitedBy: [
      ...new Set(
        miss.limitedBy.flatMap(
          (foodId) =>
            groups.find((group) => group.foodId === foodId)?.lines.map(({ line }) => line.name) ??
            [],
        ),
      ),
    ],
  }));

const isAvoided = (line: SuggestionLine, preferences: readonly PalatePreference[]): boolean =>
  avoidsFood({ name: line.name }, preferences).avoid ||
  (line.food !== null && avoidsFood(line.food, preferences).avoid);

const draftLine = (
  line: SuggestionLine,
  matched: { food: Food; grams: number; kcal: number | null } | null,
) => ({
  name: line.name,
  foodId: matched?.food.id ?? null,
  foodName: matched?.food.name ?? null,
  grams: matched?.grams ?? line.grams,
  beforeGrams: null,
  kcal: matched?.kcal ?? null,
  change: "same" as const,
});

/**
 * The draft of a suggested recipe, from the lines the model proposed and the foods they matched. The model
 * proposes names and amounts and nothing else: every figure is `computeRecipe`'s, over the amounts that remain
 * after `fitRecipeToTargets` has brought a serving within tolerance of `target` (ADR 0006, Amendment 6).
 *
 * A line that names a food the person avoids, or matched one, is dropped, and is in neither the figures nor
 * the lines. A line with no food, or with a food that cannot be weighed, is kept as an unmatched line, shown
 * after the others and left out of the figures. When no line is left to count the answer is `nothing_matched`,
 * with the names that were dropped. A name or a step that mentions an avoided food is `mentions_avoided`.
 * A target that cannot be reached still gives the closest draft, and its fit says so with the ingredients that
 * limit it, by name.
 */
export function buildSuggestionDraft(input: SuggestionInput): SuggestionOutcome {
  const { name, servings, steps, lines, target, preferences } = input;
  // The name and the steps are text the person reads and follows, so a mention of an avoided food in either one
  // refuses the whole recipe. Matching is by name only, as everywhere (the ruling of 2026-11-13).
  if ([name, ...steps].some((text) => avoidsFood({ name: text }, preferences).avoid)) {
    return { status: "mentions_avoided" };
  }
  const dropped = lines.filter((line) => isAvoided(line, preferences));
  const kept = lines.filter((line) => !dropped.includes(line));
  const counted = kept.flatMap((line): CountedLine[] => {
    const per100 = line.food === null ? null : per100Of(line.food, line.portions);
    return line.food === null || per100 === null ? [] : [{ line, food: line.food, per100 }];
  });
  if (counted.length === 0) {
    return { status: "nothing_matched", leftOutAvoided: dropped.map((line) => line.name) };
  }

  const groups = groupsOf(counted);
  const fit =
    Object.keys(target).length === 0
      ? null
      : fitRecipeToTargets({
          servings,
          target,
          ingredients: groups.map(({ foodId, per100, proposedGrams }) => ({
            foodId,
            per100,
            grams: proposedGrams,
            locked: false,
          })),
        });

  const ingredients = new Map<SuggestionLine, RecipeIngredient>();
  for (const group of groups) {
    const fittedGrams =
      fit?.ingredients.find(({ foodId }) => foodId === group.foodId)?.grams ?? group.proposedGrams;
    for (const { line, food } of group.lines) {
      ingredients.set(
        line,
        buildRecipeIngredient(food, {
          quantity: (fittedGrams * line.grams) / group.proposedGrams,
          unit: "g",
          foodPortions: line.portions,
        }),
      );
    }
  }
  const computed = computeRecipe({
    servings,
    yieldGrams: null,
    ingredients: counted
      .map(({ line }) => ingredients.get(line))
      .filter((found) => found !== undefined),
  });

  const matchedLines = counted.flatMap(({ line, food }) => {
    const ingredient = ingredients.get(line);
    return ingredient === undefined
      ? []
      : [
          draftLine(line, {
            food,
            grams: ingredient.resolved_grams,
            kcal: computeRecipe({ servings: 1, yieldGrams: null, ingredients: [ingredient] }).total
              .kcal,
          }),
        ];
  });
  const unmatchedLines = kept
    .filter((line) => !ingredients.has(line))
    .map((line) => draftLine(line, null));

  return {
    status: "drafted",
    draft: {
      variant: "suggestion",
      name,
      servings,
      ingredients: [...matchedLines, ...unmatchedLines],
      dropped: dropped.map((line) => ({ name: line.name, reason: "avoided" })),
      perServing: figuresOf(computed.perServing),
      fit:
        fit === null
          ? null
          : {
              status: fit.status,
              target: { ...target },
              misses: withLimitsNamed(fit.misses, groups),
            },
      steps: [...steps],
    },
  };
}

/**
 * What the model reads of a draft: the name, the servings, the figures of a serving, the fit and what was left
 * out. It holds no ingredient line and no step, so the model has nothing of the recipe to retell. The card
 * shows them (ADR 0006).
 */
export function recipeDraftSummaryOf(draft: AssistantRecipeDraft) {
  return {
    name: draft.name,
    servings: draft.servings,
    per_serving: draft.perServing,
    fit: draft.fit?.status ?? null,
    misses: (draft.fit?.misses ?? []).map(({ nutrient, target, achieved, reason }) => ({
      nutrient,
      target,
      achieved,
      reason,
    })),
    not_matched: draft.ingredients.filter(({ foodId }) => foodId === null).map(({ name }) => name),
    left_out_avoided: draft.dropped.map(({ name }) => name),
  };
}
