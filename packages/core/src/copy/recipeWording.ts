// @not-in-barrel Internal to the copy: the recipe modules use it, and it is not part of @keylow/core/copy.
import { describeFoodRowStats } from "./foodRow";
import { spokenAmount } from "./spokenAmount";
import { formatGroupedGrams } from "../format/groupedGrams";
import { formatCalories, formatGrams } from "../format/numbers";

import type { RecipeComputed } from "../recipes/schemas";
import type { NullableNutrients } from "../schemas/nutrients";

/** What a recipe has to tell about its servings: how many, and the weight of the dish they share. */
export type RecipeServings = {
  servings: number;
  /** `effectiveGrams` is the cooked weight, or the raw total when the recipe has no cooked weight. */
  computed: Pick<RecipeComputed, "effectiveGrams">;
};

/** The weight of one serving: the cooked weight over the servings, or the raw total over them without one. */
export const gramsOfOneServing = (recipe: RecipeServings): number =>
  recipe.computed.effectiveGrams / recipe.servings;

/**
 * One serving with its weight: "1 serving (275 g)". A recipe with no weight (ADR 0003, Amendment 19) has
 * none to give: "1 serving".
 */
export const describeOneServing = (recipe: RecipeServings): string =>
  recipe.computed.effectiveGrams === 0
    ? "1 serving"
    : `1 serving (${formatGroupedGrams(gramsOfOneServing(recipe))} g)`;

/** Grams for a screen reader, in whole grams with a separator and "1 gram" in the singular: "275 grams". */
export const describeSpokenGrams = (grams: number): string =>
  spokenAmount(formatGroupedGrams(grams), "gram", "grams");

/** One serving for a screen reader, with its weight when it has one: "1 serving 275 grams", or "1 serving". */
export const describeSpokenOneServing = (recipe: RecipeServings): string =>
  recipe.computed.effectiveGrams === 0
    ? "1 serving"
    : `1 serving ${describeSpokenGrams(gramsOfOneServing(recipe))}`;

/** The energy and macros of an amount for a screen reader, the way a food row reads them. */
export const describeSpokenNutrients = (
  nutrients: Pick<NullableNutrients, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
): string => {
  const { kcal, protein_g, carbs_g, fat_g } = nutrients;
  const inGrams = (grams: number | null) => (grams === null ? undefined : formatGrams(grams));

  return describeFoodRowStats({
    energy: kcal === null ? undefined : formatCalories(kcal),
    protein: inGrams(protein_g),
    carbs: inGrams(carbs_g),
    fat: inGrams(fat_g),
  });
};
