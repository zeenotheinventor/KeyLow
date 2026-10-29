import { MAX_SHOPPING_ITEM_SOURCES } from "./bounds";
import { classifyIngredient } from "./classifyIngredient";
import { scaleFactor } from "../recipes/scaleRecipe";

import type { ClassifiableFood, StapleRule } from "./classifyIngredient";
import type { ShoppingSource } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";

/**
 * What the list reads of one stored ingredient. `name` is the food's name as the recipe froze it, which
 * is the name the item is given. `food` is the food as it is now, which the rules sort by, or null when
 * it cannot be read, and then the frozen name is sorted with no group. `portionLabel` is set for the
 * portion unit only.
 */
export type ShoppingIngredient = {
  foodId: string;
  name: string;
  food: ClassifiableFood | null;
  quantity: number;
  unit: QuantityUnit;
  resolvedGrams: number;
  portionLabel: string | null;
};

/** One recipe to add, at the servings the person chose, with its ingredients in list order. */
export type ShoppingRecipe = {
  recipeId: string;
  recipeName: string;
  recipeServings: number;
  chosenServings: number;
  ingredients: readonly ShoppingIngredient[];
};

/**
 * One food the recipes need, summed over every ingredient of that food: the grams, the count of portions
 * when every one of them used the same portion, and the recipes it came from, each once. `rule` says
 * why it is an item or a staple.
 */
export type ShoppingDraft = {
  foodId: string;
  name: string;
  grams: number;
  portionLabel: string | null;
  portionCount: number | null;
  sources: ShoppingSource[];
  rule: StapleRule;
};

/** The foods to buy, and the store cupboard staples left out unless the person adds them anyway. */
export type AggregatedIngredients = { items: ShoppingDraft[]; staples: ShoppingDraft[] };

type Running = ShoppingDraft & { isStaple: boolean; isSamePortion: boolean };

const withSource = (sources: ShoppingSource[], source: ShoppingSource): ShoppingSource[] =>
  sources.length >= MAX_SHOPPING_ITEM_SOURCES ||
  sources.some(({ recipeId }) => recipeId === source.recipeId)
    ? sources
    : [...sources, source];

/**
 * Sums the ingredients of several recipes into one draft per food, in the order each food first
 * appears. Each recipe is scaled by `scaleFactor`, so it throws the same `RangeError` for servings that
 * are not a number it accepts, before anything is summed. A food is sorted once, by its first
 * ingredient, with `classifyIngredient`. A count of portions is kept only while every ingredient of the
 * food used the same portion label. Grams are always kept, and nothing is rounded.
 */
export function aggregateIngredients(recipes: readonly ShoppingRecipe[]): AggregatedIngredients {
  const factors = recipes.map((recipe) =>
    scaleFactor(recipe.chosenServings, recipe.recipeServings),
  );
  const byFood = new Map<string, Running>();

  recipes.forEach((recipe, index) => {
    const factor = factors[index] ?? 1;
    const source: ShoppingSource = { recipeId: recipe.recipeId, name: recipe.recipeName };

    for (const ingredient of recipe.ingredients) {
      const grams = ingredient.resolvedGrams * factor;
      const count = ingredient.unit === "portion" ? ingredient.quantity * factor : null;
      const label = ingredient.unit === "portion" ? ingredient.portionLabel : null;
      const running = byFood.get(ingredient.foodId);

      if (running === undefined) {
        const sorted = classifyIngredient(
          ingredient.food ?? { name: ingredient.name, food_group: null },
        );
        byFood.set(ingredient.foodId, {
          foodId: ingredient.foodId,
          name: ingredient.name,
          grams,
          portionLabel: label,
          portionCount: label === null ? null : count,
          sources: [source],
          rule: sorted.rule,
          isStaple: sorted.kind === "staple",
          isSamePortion: label !== null,
        });
        continue;
      }

      const isSamePortion =
        running.isSamePortion && label !== null && label === running.portionLabel;
      running.grams += grams;
      running.isSamePortion = isSamePortion;
      running.portionLabel = isSamePortion ? running.portionLabel : null;
      running.portionCount =
        isSamePortion && running.portionCount !== null && count !== null
          ? running.portionCount + count
          : null;
      running.sources = withSource(running.sources, source);
    }
  });

  const drafts = [...byFood.values()];
  const draftOf = (running: Running): ShoppingDraft => ({
    foodId: running.foodId,
    name: running.name,
    grams: running.grams,
    portionLabel: running.portionLabel,
    portionCount: running.portionCount,
    sources: running.sources,
    rule: running.rule,
  });

  return {
    items: drafts.filter((draft) => !draft.isStaple).map(draftOf),
    staples: drafts.filter((draft) => draft.isStaple).map(draftOf),
  };
}
