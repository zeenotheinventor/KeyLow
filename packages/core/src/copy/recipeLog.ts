import {
  describeOneServing,
  describeSpokenGrams,
  describeSpokenNutrients,
  gramsOfOneServing,
} from "./recipeWording";
import { nutrientsOfRecipeSnapshot } from "../diary/recipeSnapshotQuantity";
import { formatGroupedGrams } from "../format/groupedGrams";
import { formatScaledCount } from "../format/scaledCount";

import type { RecipeServings } from "./recipeWording";
import type { RecipeSnapshot } from "../diary/schemas";
import type { RecipeComputed } from "../recipes/schemas";

/** The small badge in front of the yield line on the amount step and the entry screen. */
export const RECIPE_BADGE = "Recipe";

export const RECIPE_UNITS = {
  /** The chip that picks a number of servings, the recipe's natural unit. */
  serving: "1 serving",
  /** The chip that picks grams of the cooked dish, or of the raw ingredients when the recipe has no cooked weight. */
  grams: "g",
};

/** The entry screen's line for an entry whose recipe has been archived since. */
export const RECIPE_ARCHIVED_NOTICE =
  "This recipe has been archived. Your entry keeps its saved values.";

/** The suffix of the amount field: "serving" for exactly 1, "servings" for anything else. */
export const describeServingSuffix = (amount: number): string =>
  amount === 1 ? "serving" : "servings";

/** The part of an amount that the sentences read: a number of servings or of grams, and the weight it comes to. */
type RecipeAmountWording = Pick<RecipeSnapshot, "unit" | "quantity" | "resolvedGrams">;

/** One serving of a recipe as a search row writes it: "1 serving (275 g)". */
export const describeRecipeServing = (recipe: RecipeServings): string => describeOneServing(recipe);

/**
 * An amount of a recipe: "1 serving (275 g)", "1.5 servings (413 g)" or "300 g". A number of servings
 * carries the weight it comes to, rounded the way every gram is (412.5 reads 413).
 */
export const describeRecipeLoggedAmount = (amount: RecipeAmountWording): string =>
  amount.unit === "g"
    ? `${formatGroupedGrams(amount.quantity)} g`
    : `${formatScaledCount(amount.quantity)} ${describeServingSuffix(amount.quantity)} (${formatGroupedGrams(amount.resolvedGrams)} g)`;

/** The hero's caption: "For 1 serving (275 g)", "For 1.5 servings (413 g)" or "For 300 g". */
export const describeRecipeAmountBasis = (amount: RecipeAmountWording): string =>
  `For ${describeRecipeLoggedAmount(amount)}`;

/**
 * The yield line: "Makes 4 · 1,100 g cooked", or "Makes 4 · no cooked weight" when the recipe has none.
 * The cooked weight is in whole grams.
 */
export const describeRecipeYield = (servings: number, yieldGrams: number | null): string =>
  `Makes ${formatScaledCount(servings)} · ${
    yieldGrams === null
      ? "no cooked weight"
      : `${formatGroupedGrams(Math.round(yieldGrams))} g cooked`
  }`;

/** The heading of the per 100 g card: the grams are of the cooked dish, or of the raw ingredients without a cooked weight. */
export const describeRecipePer100Heading = (yieldGrams: number | null): string =>
  yieldGrams === null ? "Per 100 g raw" : "Per 100 g cooked";

/** The line under the hero when grams are entered for a recipe with no cooked weight. */
export const describeRawGramsNote = (totalGrams: number): string =>
  `No cooked weight is set, so these grams are of the raw ingredients (${formatGroupedGrams(totalGrams)} g in total).`;

/**
 * The raw grams note as the hero's description reads it, after the kcal: "For 275 grams. No cooked weight
 * is set, so these grams are of the raw ingredients, 720 grams in total."
 */
export const describeSpokenRawGramsNote = (amountGrams: number, totalGrams: number): string =>
  `For ${describeSpokenGrams(amountGrams)}. No cooked weight is set, so these grams are of the raw ingredients, ${describeSpokenGrams(totalGrams)} in total.`;

/** A recipe as a search row reads it: its name is given beside it. */
type RecipeForSearchRow = RecipeServings & {
  computed: Pick<RecipeComputed, "perServing">;
};

/**
 * The name of a recipe row in the food search, read in words: "Chicken and rice, recipe, 1 serving 275
 * grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, choose amount". A row
 * that opens nothing yet (the log search before the amount step) leaves "choose amount" out.
 */
export const describeRecipeSearchRowName = (
  name: string,
  recipe: RecipeForSearchRow,
  { choosesAmount = true }: { choosesAmount?: boolean } = {},
): string =>
  [
    name,
    "recipe",
    `1 serving ${describeSpokenGrams(gramsOfOneServing(recipe))}`,
    describeSpokenNutrients(recipe.computed.perServing),
    ...(choosesAmount ? ["choose amount"] : []),
  ].join(", ");

/**
 * The name of a logged recipe's diary row: "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374
 * kilocalories, protein 32 grams, ...". The values are those of the amount logged, worked out from the
 * entry's own snapshot.
 */
export const describeRecipeLoggedRowName = (
  clockTime: string,
  snapshot: RecipeSnapshot,
): string => {
  const amount =
    snapshot.unit === "g"
      ? describeSpokenGrams(snapshot.quantity)
      : `${formatScaledCount(snapshot.quantity)} ${describeServingSuffix(snapshot.quantity)} ${describeSpokenGrams(snapshot.resolvedGrams)}`;

  return [
    clockTime,
    snapshot.name,
    "recipe",
    amount,
    describeSpokenNutrients(nutrientsOfRecipeSnapshot(snapshot)),
  ].join(", ");
};
