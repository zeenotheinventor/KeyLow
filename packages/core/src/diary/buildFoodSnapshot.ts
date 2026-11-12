import { withQuantity } from "./snapshotQuantity";
import { SNAPSHOT_VERSION } from "./versions";
import { densityForLogging } from "../nutrition/volume";

import type { FoodSnapshot, SnapshotPortion } from "./schemas";
import type { PortionForDensity } from "../nutrition/labelDensity";
import type { QuantityUnit } from "../nutrition/units";
import type { Food, FoodPortion } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

export type FoodSnapshotInput = {
  quantity: number;
  unit: QuantityUnit;
  /** Read only when the unit is `portion`. */
  portion?: Pick<FoodPortion, "label" | "grams" | "ml">;
  /**
   * The food's own portions, which a density is read from when the food and the tables give none (a
   * serving such as "1 tbsp (15 g)", see `estimateDensity`). Give the portions the picker was drawn from, so
   * the entry freezes the density its chips and its hero used. Left out, only the food's own density and
   * the tables apply.
   */
  foodPortions?: readonly PortionForDensity[];
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
  basis: Food["basis"],
): SnapshotPortion => {
  if (basis === "per_portion") {
    if (portion.grams !== null || portion.ml !== null) {
      throw new RangeError("The portion of a food per portion has no size");
    }
    return { label: portion.label };
  }
  if (portion.grams !== null && portion.ml === null) {
    return { label: portion.label, grams: portion.grams };
  }
  if (portion.grams === null && portion.ml !== null) {
    return { label: portion.label, ml: portion.ml };
  }
  throw new RangeError("A portion needs exactly one of grams and ml");
};

/**
 * Freezes a food at the moment it is logged: its name, basis, per 100 values and density (its own, else
 * the estimate for its group or from its serving label, so a later change to the density table or to the
 * food's portions never changes the entry), plus the
 * quantity, unit and portion it was logged with and the grams that resolves to. Optional nutrients
 * the food does not record are left out of `per100` (ADR 0003, Amendment 2), and micronutrients are
 * never carried.
 *
 * A food per portion is frozen with its one portion's values in `per100`, no density, `resolvedGrams` of 0
 * and the portion as its label alone.
 *
 * Throws a `RangeError` for a negative quantity, for the `portion` unit without a portion, for a portion
 * that does not have exactly one of `grams` and `ml` (and, for a food per portion, for a portion that has
 * either) and for a unit other than `portion` on a food per portion.
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
      density: food.basis === "per_portion" ? null : densityForLogging(food, input.foodPortions),
    },
    {
      quantity: input.quantity,
      unit: input.unit,
      portion:
        input.unit === "portion" && input.portion !== undefined
          ? toSnapshotPortion(input.portion, food.basis)
          : null,
    },
  );
