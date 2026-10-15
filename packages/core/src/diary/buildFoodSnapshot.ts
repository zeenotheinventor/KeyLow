import { withQuantity } from "./snapshotQuantity";
import { SNAPSHOT_VERSION } from "./versions";

import type { FoodSnapshot, SnapshotPortion } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { Food, FoodPortion } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

export type FoodSnapshotInput = {
  quantity: number;
  unit: QuantityUnit;
  /** Read only when the unit is `portion`. */
  portion?: Pick<FoodPortion, "label" | "grams" | "ml">;
};

const optionalNutrientKeys = ["sat_fat_g", "sugars_g", "salt_g"] as const;

/** The five required values always, and an optional value only when the food records one. */
const buildPer100 = (food: Food): NullableNutrients => {
  const per100: NullableNutrients = {
    kcal: food.kcal,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    fibre_g: food.fibre_g,
  };
  for (const key of optionalNutrientKeys) {
    const value = food[key];
    if (value !== null) {
      per100[key] = value;
    }
  }
  return per100;
};

const toSnapshotPortion = (
  portion: Pick<FoodPortion, "label" | "grams" | "ml">,
): SnapshotPortion => {
  if (portion.grams !== null && portion.ml === null) {
    return { label: portion.label, grams: portion.grams };
  }
  if (portion.grams === null && portion.ml !== null) {
    return { label: portion.label, ml: portion.ml };
  }
  throw new RangeError("A portion needs exactly one of grams and ml");
};

/**
 * Freezes a food at the moment it is logged: its name, basis, per 100 values and density, plus the
 * quantity, unit and portion it was logged with and the grams that resolves to. Optional nutrients
 * the food does not record are left out of `per100` (ADR 0003, Amendment 2), and micronutrients are
 * never carried.
 *
 * Throws a `RangeError` for a negative quantity, for the `portion` unit without a portion, and for a
 * portion that does not have exactly one of `grams` and `ml`.
 */
export const buildFoodSnapshot = (food: Food, input: FoodSnapshotInput): FoodSnapshot =>
  withQuantity(
    {
      v: SNAPSHOT_VERSION,
      kind: "food",
      ref: food.id,
      name: food.name,
      basis: food.basis,
      per100: buildPer100(food),
      density: food.density_g_per_ml,
    },
    {
      quantity: input.quantity,
      unit: input.unit,
      portion:
        input.unit === "portion" && input.portion !== undefined
          ? toSnapshotPortion(input.portion)
          : null,
    },
  );
