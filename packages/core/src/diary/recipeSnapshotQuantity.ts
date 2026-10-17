import { recipeEntryUnitSchema } from "./schemas";
import { NUTRITION_ENGINE_VERSION, SNAPSHOT_VERSION } from "./versions";

import type { RecipeEntryUnit, RecipeSnapshot } from "./schemas";
import type { Recipe, RecipeComputed } from "../recipes/schemas";
import type { NullableNutrients } from "../schemas/nutrients";

/**
 * The part of a recipe an entry is made from: its row, as the library reads it, and the `computed` cache
 * saved with it. Only the totals and the cooked weight are read from the cache (ADR 0003, Amendment 8), so
 * what the screen showed when the amount was chosen is what is logged.
 */
export type LoggableRecipe = Pick<Recipe, "name" | "servings" | "yield_grams"> & {
  id: string;
  computed: Pick<RecipeComputed, "total" | "effectiveGrams">;
};

/** An amount of a recipe: a number of its servings, or grams of its cooked weight. */
export type RecipeAmount = { quantity: number; unit: RecipeEntryUnit };

/** The part of a snapshot that is the recipe, as opposed to how much of it was logged. */
export type FrozenRecipe = Omit<
  RecipeSnapshot,
  "quantity" | "unit" | "resolvedGrams" | "engineVersion"
>;

const optionalKeys = ["sat_fat_g", "sugars_g", "salt_g"] as const;

/** Freezes a recipe. The totals are copied, so a later edit to the recipe's cache cannot reach the snapshot. */
export const freezeRecipe = (recipe: LoggableRecipe): FrozenRecipe => ({
  v: SNAPSHOT_VERSION,
  kind: "recipe",
  ref: recipe.id,
  name: recipe.name,
  servings: recipe.servings,
  yieldGrams: recipe.yield_grams,
  effectiveGrams: recipe.computed.effectiveGrams,
  total: { ...recipe.computed.total },
});

/**
 * The only place an amount of a recipe becomes grams. By serving the grams are
 * (quantity x effectiveGrams) / servings, by grams they are the quantity itself. The order of the
 * arithmetic is part of the contract (ADR 0003, Amendment 8), because floating point makes the orders
 * differ in the last digits and a stored entry must rebuild bit for bit.
 *
 * Throws a `RangeError` for a unit that is not `serving` or `g`, a negative or non-finite quantity,
 * servings or cooked weight that is not above 0, and an amount too large to work out. The messages state
 * the rule and never the value, because the amount is health data.
 */
export const withRecipeQuantity = (recipe: FrozenRecipe, amount: RecipeAmount): RecipeSnapshot => {
  if (!recipeEntryUnitSchema.options.includes(amount.unit)) {
    throw new RangeError("The unit must be serving or g");
  }
  if (!Number.isFinite(amount.quantity) || amount.quantity < 0) {
    throw new RangeError("The quantity must be a finite number of at least 0");
  }
  if (!Number.isFinite(recipe.servings) || recipe.servings <= 0) {
    throw new RangeError("The recipe's servings must be a finite number above 0");
  }
  if (!Number.isFinite(recipe.effectiveGrams) || recipe.effectiveGrams <= 0) {
    throw new RangeError("The recipe's cooked weight must be a finite number above 0");
  }
  const resolvedGrams =
    amount.unit === "serving"
      ? (amount.quantity * recipe.effectiveGrams) / recipe.servings
      : amount.quantity;
  if (!Number.isFinite(resolvedGrams)) {
    throw new RangeError("The amount is too large to work out");
  }
  return {
    ...recipe,
    quantity: amount.quantity,
    unit: amount.unit,
    resolvedGrams,
    engineVersion: NUTRITION_ENGINE_VERSION,
  };
};

/**
 * Rebuilds `nutrients` from a recipe snapshot alone: no recipe is read, so the answer cannot change when
 * the recipe does. Per key, by serving it is (total x quantity) / servings, by grams it is
 * (total x grams) / effectiveGrams, in exactly that order and with nothing rounded. A null stays null and
 * an absent optional key stays absent.
 *
 * Throws a `RangeError` when the answer is not a finite number, which the message states without the value.
 */
export const nutrientsOfRecipeSnapshot = (snapshot: RecipeSnapshot): NullableNutrients => {
  const divisor = snapshot.unit === "serving" ? snapshot.servings : snapshot.effectiveGrams;
  const scaleValue = (value: number | null): number | null => {
    if (value === null) {
      return null;
    }
    const scaled = (value * snapshot.quantity) / divisor;
    if (!Number.isFinite(scaled)) {
      throw new RangeError("The amount is too large to work out");
    }
    return scaled;
  };
  const { total } = snapshot;
  const nutrients: NullableNutrients = {
    kcal: scaleValue(total.kcal),
    protein_g: scaleValue(total.protein_g),
    fat_g: scaleValue(total.fat_g),
    carbs_g: scaleValue(total.carbs_g),
    fibre_g: scaleValue(total.fibre_g),
  };
  for (const key of optionalKeys) {
    const value = total[key];
    if (value !== undefined) {
      nutrients[key] = scaleValue(value);
    }
  }
  return nutrients;
};
