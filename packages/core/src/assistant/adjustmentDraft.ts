import { figuresOf, per100Of } from "./draftNutrients";
import { recipeDraftSummaryOf } from "./recipeDraftOf";
import { withQuantity } from "../diary/snapshotQuantity";
import { avoidsFood } from "../palate";
import { buildRecipeIngredient, computeRecipe } from "../recipes";
import { MAX_RECIPE_NAME_LENGTH } from "../recipes/bounds";
import { fitRecipeToTargets, outOfTolerance } from "../recipes/fit";

import type { DraftFigures } from "./draftNutrients";
import type { AssistantRecipeDraft } from "./recipeDraft";
import type { PalatePreference } from "../palate";
import type { RecipeIngredient } from "../recipes";
import type { FitIngredient, FitMiss, FitResult, FitTarget } from "../recipes/fit";
import type { Food, FoodPortion } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

export type AdjustmentDraft = Extract<AssistantRecipeDraft, { variant: "adjustment" }>;

/**
 * How much of a food the fitter may add to a recipe, in grams: it starts at `start` and stays between `minimum`
 * and `maximum`, so an added food is never fitted away to nothing and never swamps the dish.
 */
export const ADJUSTMENT_ADDITION_GRAMS = { start: 50, minimum: 10, maximum: 300 } as const;

/** A stored recipe as the adjustment reads it: its own frozen ingredients, never a live food. */
export type AdjustmentRecipe = {
  id: string;
  name: string;
  servings: number;
  steps: readonly string[];
  ingredients: readonly RecipeIngredient[];
};

/** A food of the person's own that may be added, with its portions. */
export type AdjustmentCandidate = { food: Food; portions: readonly FoodPortion[] };

export type AdjustmentInput = {
  recipe: AdjustmentRecipe;
  /** What a serving should come to, from `adjustmentTarget`. */
  target: FitTarget;
  /** Foods the fitter may add. One the person avoids is left out. */
  additions: readonly AdjustmentCandidate[];
  preferences: readonly PalatePreference[];
};

export type AdjustmentOutcome =
  | { status: "drafted"; draft: AdjustmentDraft }
  /** The closest figures a serving reached, and what held each missed target back, by ingredient name. */
  | { status: "unreachable"; reached: NullableNutrients; misses: FitMiss[] }
  /** The recipe's own name or a step names a food the person avoids. */
  | { status: "mentions_avoided" }
  /** The stored recipe holds foods the person avoids, named as the recipe names them. It is not adjusted. */
  | { status: "has_avoided_ingredient"; foods: string[] };

const nameOf = (text: string): string => text.slice(0, MAX_RECIPE_NAME_LENGTH);

const lineKcalOf = (ingredient: RecipeIngredient): number | null =>
  computeRecipe({ servings: 1, yieldGrams: null, ingredients: [ingredient] }).total.kcal;

// The nutrients of 100 g of a frozen ingredient, or its whole amount when it has no weight (a food per portion),
// which is then a locked 100 g line, so its figures count and never move.
const fitIngredientOf = (ingredient: RecipeIngredient, key: string): FitIngredient => {
  if (ingredient.resolved_grams === 0) {
    const whole = computeRecipe({ servings: 1, yieldGrams: null, ingredients: [ingredient] }).total;
    return { foodId: key, per100: whole, grams: 100, locked: true };
  }
  const per100 = computeRecipe({
    servings: 1,
    yieldGrams: null,
    ingredients: [
      {
        resolved_grams: 100,
        snapshot: withQuantity(ingredient.snapshot, { quantity: 100, unit: "g" }),
      },
    ],
  }).total;
  return { foodId: key, per100, grams: ingredient.resolved_grams, locked: false };
};

const rescaled = (ingredient: RecipeIngredient, grams: number): RecipeIngredient => {
  if (ingredient.resolved_grams === 0 || grams === ingredient.resolved_grams) {
    return ingredient;
  }
  const snapshot = withQuantity(ingredient.snapshot, { quantity: grams, unit: "g" });
  return {
    ...ingredient,
    quantity: grams,
    unit: "g",
    portion_id: null,
    resolved_grams: snapshot.resolvedGrams,
    snapshot,
  };
};

const isAvoided = (food: { id: string; name: string }, preferences: readonly PalatePreference[]) =>
  avoidsFood(food, preferences).avoid;

/** A food that may be added, with the figures of 100 g of it that the model is shown. */
export type OfferedCandidate = AdjustmentCandidate & { per100: DraftFigures };

/**
 * Foods that may be added to `recipe` to close a gap: the given foods in their order, without one the person
 * avoids, one the recipe already holds and one that has no weight, which cannot be added in grams.
 */
export function adjustmentCandidatesOf(input: {
  foods: readonly AdjustmentCandidate[];
  recipe: Pick<AdjustmentRecipe, "ingredients">;
  preferences: readonly PalatePreference[];
}): OfferedCandidate[] {
  const held = new Set(input.recipe.ingredients.map(({ food_id }) => food_id));
  return input.foods.flatMap(({ food, portions }) => {
    const per100 = per100Of(food, portions);
    return per100 === null || isAvoided(food, input.preferences) || held.has(food.id)
      ? []
      : [{ food, portions, per100: figuresOf(per100) }];
  });
}

/**
 * The targets a version still misses. The fitter's own misses when it says unreachable. Otherwise core's own
 * judgement of `after`, the figures of the amounts that will be drawn, so a fit the fitter calls within can never
 * be drafted when its figures miss.
 */
export function unmetAfterFit(
  fit: Pick<FitResult, "status" | "misses">,
  after: NullableNutrients,
  target: FitTarget,
): FitMiss[] {
  if (fit.status === "unreachable") {
    return fit.misses;
  }
  return outOfTolerance(after, target).map(({ nutrient, target: wanted, achieved }) => ({
    nutrient,
    target: wanted,
    achieved,
    reason: achieved === null ? "no_data" : "targets_conflict",
    limitedBy: [],
  }));
}

/**
 * The draft of a stored recipe changed to hit `target` a serving (ADR 0006, Amendment 6). The ingredients are
 * scaled by `fitRecipeToTargets`, with the foods in `additions` as extra adjustable lines, and every figure is
 * `computeRecipe`'s over the amounts that result. `before` is the stored recipe as it is. Nothing here changes
 * the recipe it was given: the person saves the draft as a new recipe.
 *
 * Only a version the fitter finds within tolerance is drafted. Otherwise the answer is `unreachable`, with the
 * closest figures and what limits them, and never a draft that misses. A recipe that holds an ingredient the
 * person avoids, or whose name or step mentions an avoided food, is refused and not adjusted.
 */
export function buildAdjustmentDraft(input: AdjustmentInput): AdjustmentOutcome {
  const { recipe, target, preferences } = input;
  if (
    [recipe.name, ...recipe.steps].some((text) => isAvoided({ id: "", name: text }, preferences))
  ) {
    return { status: "mentions_avoided" };
  }
  // Leaving an avoided ingredient out would make a different dish, and `before` would no longer be the same
  // recipe, so a recipe that holds one is refused and the person removes it themselves.
  const avoidedIngredients = recipe.ingredients.filter(({ food_id, snapshot }) =>
    isAvoided({ id: food_id, name: snapshot.name }, preferences),
  );
  if (avoidedIngredients.length > 0) {
    return {
      status: "has_avoided_ingredient",
      foods: avoidedIngredients.map(({ snapshot }) => snapshot.name),
    };
  }
  const kept = recipe.ingredients;
  // A food the recipe already holds is already adjustable, and one the person avoids was never in the recipe, so
  // neither is added.
  const held = new Set(kept.map(({ food_id }) => food_id));
  const additions = input.additions.flatMap((candidate) => {
    const per100 =
      isAvoided(candidate.food, preferences) || held.has(candidate.food.id)
        ? null
        : per100Of(candidate.food, candidate.portions);
    return per100 === null ? [] : [{ ...candidate, per100 }];
  });

  const { start, minimum, maximum } = ADJUSTMENT_ADDITION_GRAMS;
  const fit = fitRecipeToTargets({
    servings: recipe.servings,
    target,
    ingredients: [
      ...kept.map((ingredient, index) => fitIngredientOf(ingredient, `kept-${index}`)),
      ...additions.map(({ per100 }, index): FitIngredient => ({
        foodId: `added-${index}`,
        per100,
        grams: start,
        locked: false,
        minGrams: minimum,
        maxGrams: maximum,
      })),
    ],
  });
  const gramsOf = (key: string, fallback: number) =>
    fit.ingredients.find(({ foodId }) => foodId === key)?.grams ?? fallback;

  const scaled = kept.map((ingredient, index) =>
    rescaled(ingredient, gramsOf(`kept-${index}`, ingredient.resolved_grams)),
  );
  const added = additions.map(({ food, portions }, index) =>
    buildRecipeIngredient(food, {
      quantity: gramsOf(`added-${index}`, start),
      unit: "g",
      foodPortions: portions,
    }),
  );
  const after = computeRecipe({
    servings: recipe.servings,
    yieldGrams: null,
    ingredients: [...scaled, ...added],
  }).perServing;

  const names = new Map<string, string>([
    ...kept.map((ingredient, index): [string, string] => [
      `kept-${index}`,
      ingredient.snapshot.name,
    ]),
    ...additions.map(({ food }, index): [string, string] => [`added-${index}`, food.name]),
  ]);
  const unmet = unmetAfterFit(fit, after, target);
  if (unmet.length > 0) {
    const named = unmet.map((miss) => ({
      ...miss,
      limitedBy: miss.limitedBy.map((key) => names.get(key) ?? "").filter((name) => name !== ""),
    }));
    return { status: "unreachable", reached: after, misses: named };
  }

  const before = computeRecipe({
    servings: recipe.servings,
    yieldGrams: null,
    ingredients: recipe.ingredients,
  }).perServing;
  return {
    status: "drafted",
    draft: {
      variant: "adjustment",
      recipeId: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      ingredients: [
        ...scaled.map((ingredient, index) => ({
          name: nameOf(ingredient.snapshot.name),
          foodId: ingredient.food_id,
          foodName: nameOf(ingredient.snapshot.name),
          grams: ingredient.resolved_grams,
          beforeGrams: kept[index]?.resolved_grams ?? null,
          kcal: lineKcalOf(ingredient),
          change:
            ingredient.resolved_grams === kept[index]?.resolved_grams
              ? ("same" as const)
              : ("changed" as const),
        })),
        ...added.map((ingredient) => ({
          name: nameOf(ingredient.snapshot.name),
          foodId: ingredient.food_id,
          foodName: nameOf(ingredient.snapshot.name),
          grams: ingredient.resolved_grams,
          beforeGrams: null,
          kcal: lineKcalOf(ingredient),
          change: "added" as const,
        })),
      ],
      dropped: [],
      before: figuresOf(before),
      perServing: figuresOf(after),
      fit: { status: "within", target: { ...target }, misses: [] },
      steps: [...recipe.steps],
    },
  };
}

/**
 * What the model reads of an adjustment: the figures before and after, the fit, the names of the foods
 * added and what was left out. No ingredient line and no step, which the card shows.
 */
export function adjustmentSummaryOf(draft: AdjustmentDraft) {
  return {
    ...recipeDraftSummaryOf(draft),
    before: draft.before,
    /** The steps are the recipe's own, so they do not mention these. */
    added_not_in_method: draft.ingredients
      .filter(({ change }) => change === "added")
      .map(({ name }) => name),
  };
}
