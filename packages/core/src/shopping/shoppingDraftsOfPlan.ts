import { aggregateIngredients } from "./aggregateIngredients";
import { classifyIngredient } from "./classifyIngredient";

import type {
  ShoppingDraft,
  ShoppingIngredient,
  ShoppingRecipe,
  AggregatedIngredients,
} from "./aggregateIngredients";
import type { ClassifiableFood } from "./classifyIngredient";

/** A recipe the plan names, with its ingredients as the list reads them. */
export type PlannedRecipeSource = {
  recipeId: string;
  recipeName: string;
  recipeServings: number;
  ingredients: readonly ShoppingIngredient[];
};

/** A food the plan names on its own, as the list reads it. `food` is null when it cannot be read now. */
export type PlannedFoodSource = {
  foodId: string;
  name: string;
  food: ClassifiableFood | null;
};

/** What buying needs of a planned item: which food or recipe, how much, and the cook a leftover points at by `key`. */
export type ShoppableItem = { key: string; leftoverOf: string | null } & (
  { kind: "recipe"; recipeId: string } | { kind: "food"; foodId: string; grams: number }
);

export type ShoppableDay = { isConfirmed: boolean; items: readonly ShoppableItem[] };

export type ShoppingDraftsOfPlanInput = {
  /** Every day of the plan, so a recipe's leftovers are found wherever they sit. */
  days: readonly ShoppableDay[];
  recipes: readonly PlannedRecipeSource[];
  foods: readonly PlannedFoodSource[];
};

const lookUp = <Source>(
  sources: readonly Source[],
  idOf: (source: Source) => string,
): ((id: string) => Source) => {
  const byId = new Map(sources.map((source) => [idOf(source), source]));
  return (id) => {
    const source = byId.get(id);
    if (source === undefined) {
      throw new RangeError("Every planned recipe and food needs its figures");
    }
    return source;
  };
};

/**
 * The foods to buy for the days of a plan that are not confirmed (a confirmed day is eaten), as
 * `aggregateIngredients` gives them, so `planListMerge` writes them as it writes any list. A recipe is bought
 * once, for the servings it is cooked for: the cooking item plus the leftovers that point at it, wherever they
 * sit. A leftover is never a second cook, and a leftover whose cook was confirmed buys nothing. A food planned
 * on its own adds its grams to the food of the same id, or is a new draft with no source, because a source is
 * a recipe. Nothing is rounded, and the sums are the ones `aggregateIngredients` makes.
 *
 * Throws a `RangeError` for a recipe or food the plan names that `recipes` or `foods` does not hold.
 */
export const shoppingDraftsOfPlan = (input: ShoppingDraftsOfPlanInput): AggregatedIngredients => {
  const recipeOf = lookUp(input.recipes, ({ recipeId }) => recipeId);
  const foodOf = lookUp(input.foods, ({ foodId }) => foodId);
  const leftoversOf = new Map<string, number>();
  for (const { items } of input.days) {
    for (const { leftoverOf } of items) {
      if (leftoverOf !== null) {
        leftoversOf.set(leftoverOf, (leftoversOf.get(leftoverOf) ?? 0) + 1);
      }
    }
  }

  const toBuy = input.days.filter(({ isConfirmed }) => !isConfirmed).flatMap(({ items }) => items);
  const cooked: ShoppingRecipe[] = [];
  const plainGrams = new Map<string, number>();
  for (const item of toBuy) {
    if (item.kind === "food") {
      plainGrams.set(item.foodId, (plainGrams.get(item.foodId) ?? 0) + item.grams);
    } else if (item.leftoverOf === null) {
      const { recipeId, recipeName, recipeServings, ingredients } = recipeOf(item.recipeId);
      cooked.push({
        recipeId,
        recipeName,
        recipeServings,
        chosenServings: 1 + (leftoversOf.get(item.key) ?? 0),
        ingredients,
      });
    }
  }

  const aggregated = aggregateIngredients(cooked);
  const items = aggregated.items.map((draft) => ({ ...draft }));
  const staples = aggregated.staples.map((draft) => ({ ...draft }));

  for (const [foodId, grams] of plainGrams) {
    const existing = [...items, ...staples].find((draft) => draft.foodId === foodId);
    if (existing !== undefined) {
      existing.grams += grams;
      existing.portionLabel = null;
      existing.portionCount = null;
      continue;
    }
    const { name, food } = foodOf(foodId);
    const sorted = classifyIngredient(food ?? { name, food_group: null });
    const draft: ShoppingDraft = {
      foodId,
      name,
      grams,
      portionLabel: null,
      portionCount: null,
      sources: [],
      rule: sorted.rule,
    };
    (sorted.kind === "staple" ? staples : items).push(draft);
  }

  return { items, staples };
};
