import { sumEntries } from "../diary/rules/sumEntries";
import { nutrientsOfSnapshot } from "../diary/snapshotQuantity";
import { NUTRITION_ENGINE_VERSION } from "../diary/versions";

import type { RecipeComputed, RecipeIngredient } from "./schemas";
import type { NullableNutrients } from "../schemas/nutrients";

export type ComputeRecipeInput = {
  servings: number;
  /** The cooked weight, or null when the recipe has none. */
  yieldGrams: number | null;
  /** Only the grams and the snapshot are read, so a stored row and a built one both fit. */
  ingredients: readonly Pick<RecipeIngredient, "resolved_grams" | "snapshot">[];
};

const optionalKeys = ["sat_fat_g", "sugars_g", "salt_g"] as const;

/** A sum over ingredients keeps an optional key only when some ingredient gave it a value. */
const withoutUnknownOptionals = (sum: ReturnType<typeof sumEntries>): NullableNutrients => {
  const nutrients: NullableNutrients = {
    kcal: sum.kcal,
    protein_g: sum.protein_g,
    fat_g: sum.fat_g,
    carbs_g: sum.carbs_g,
    fibre_g: sum.fibre_g,
  };
  for (const key of optionalKeys) {
    if (sum[key] !== null) {
      nutrients[key] = sum[key];
    }
  }
  return nutrients;
};

/** Changes every known value and leaves a null as null and an absent optional key absent. */
export const mapNutrients = (
  nutrients: NullableNutrients,
  change: (value: number) => number,
): NullableNutrients => {
  const changeValue = (value: number | null) => (value === null ? null : change(value));
  const changed: NullableNutrients = {
    kcal: changeValue(nutrients.kcal),
    protein_g: changeValue(nutrients.protein_g),
    fat_g: changeValue(nutrients.fat_g),
    carbs_g: changeValue(nutrients.carbs_g),
    fibre_g: changeValue(nutrients.fibre_g),
  };
  for (const key of optionalKeys) {
    const value = nutrients[key];
    if (value !== undefined) {
      changed[key] = changeValue(value);
    }
  }
  return changed;
};

const nothingKnown = (): NullableNutrients => ({
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
});

/**
 * A recipe's totals per 100 g of its `effectiveGrams`: each known value divided by the grams, times 100, and
 * nothing rounded. A weight that is not above 0 knows nothing (every key null), so the result never holds
 * `NaN` or `Infinity`. `computeRecipe` and `recipeOfSnapshot` both work this way, so a recipe's card and the
 * edit screen of an entry logged from it cannot give different figures.
 */
export const per100gOf = (total: NullableNutrients, effectiveGrams: number): NullableNutrients =>
  effectiveGrams > 0
    ? mapNutrients(total, (value) => (value / effectiveGrams) * 100)
    : nothingKnown();

/**
 * The numbers of a recipe, in the shape of `recipes.computed` (ADR 0003, Amendment 8). Each ingredient's
 * nutrients come from its own snapshot, so the answer never depends on a live food, and are added with
 * `sumEntries`, the `day_totals` rule: a null is skipped, and a total is null only when every ingredient
 * leaves it null. `perServing` is the total divided by the servings and `per100g` is the total divided by
 * `effectiveGrams` times 100, where `effectiveGrams` is the yield, else the sum of the ingredients' grams.
 * Nothing is rounded. A recipe with no ingredients, or one that weighs nothing, has no `per100g` (every
 * key null), so the result never holds `NaN` or `Infinity`.
 *
 * Throws a `RangeError` for servings, or a yield, that is not a finite number above 0. The messages state
 * the rule and never the value.
 */
export const computeRecipe = (input: ComputeRecipeInput): RecipeComputed => {
  const { servings, yieldGrams, ingredients } = input;
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new RangeError("Servings must be a finite number above 0");
  }
  if (yieldGrams !== null && (!Number.isFinite(yieldGrams) || yieldGrams <= 0)) {
    throw new RangeError("The yield must be a finite number above 0");
  }

  const total = withoutUnknownOptionals(
    sumEntries(
      ingredients.map((ingredient) => ({ nutrients: nutrientsOfSnapshot(ingredient.snapshot) })),
    ),
  );
  const totalGrams = ingredients.reduce((sum, ingredient) => sum + ingredient.resolved_grams, 0);
  const effectiveGrams = yieldGrams ?? totalGrams;

  return {
    total,
    perServing: mapNutrients(total, (value) => value / servings),
    per100g: per100gOf(total, effectiveGrams),
    totalGrams,
    effectiveGrams,
    engineVersion: NUTRITION_ENGINE_VERSION,
  };
};
