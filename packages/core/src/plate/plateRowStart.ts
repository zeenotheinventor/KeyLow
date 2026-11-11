import { plateFoodAmount } from "./plateFoodAmount";
import { isPlateItemValid } from "./plateValues";
import { usualQuantityOfUnit } from "../diary/startingAmount";
import { per100gOf } from "../recipes/computeRecipe";

import type { PlateFoodItem, PlateRecipeItem } from "./types";
import type { MatchedAmount } from "../diary/matchPortionOnFood";
import type { RecipeAmount } from "../diary/recipeSnapshotQuantity";
import type { RecipeOfSnapshot } from "../recipes/recipeOfSnapshot";
import type { FoodPortion } from "../schemas/food";

/**
 * The amount the portion picker opens on when a plate row's name is pressed: the row's amount and unit as the food
 * is now (`plateFoodAmount`, so a portion that has gone comes as the grams or millilitres it was). A row whose
 * amount is not valid keeps its unit and starts at that unit's usual amount (1, or 100 g or ml).
 */
export function plateFoodRowStart(
  item: PlateFoodItem,
  portions: readonly FoodPortion[],
): MatchedAmount | undefined {
  if (isPlateItemValid(item)) {
    return plateFoodAmount(item, portions);
  }
  const quantity = usualQuantityOfUnit(item.unit.kind);

  return plateFoodAmount({ ...item, quantity, quantityText: String(quantity) }, portions);
}

/** The amount the recipe picker opens on for a plate row: the row's own, or one serving's usual amount while it is not valid. */
export function plateRecipeRowStart(item: PlateRecipeItem): RecipeAmount {
  return {
    quantity: isPlateItemValid(item) ? item.quantity : usualQuantityOfUnit(item.unit),
    unit: item.unit,
  };
}

/**
 * The recipe a plate row holds, as the recipe amount step draws it: what the row stored (its totals and cooked
 * weight, which is what logging it writes) with the values per 100 g worked out from them, so editing a row needs
 * no read of the recipe and shows the figures the log will use.
 */
export function plateRecipeOfRow(item: PlateRecipeItem): RecipeOfSnapshot {
  const { total, effectiveGrams, servingsOnly = false } = item.recipe.computed;

  return {
    ...item.recipe,
    computed: { total, effectiveGrams, servingsOnly, per100g: per100gOf(total, effectiveGrams) },
  };
}
