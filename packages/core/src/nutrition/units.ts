import { z } from "zod";

import type { Food, FoodPortion, NutrientBasis } from "../schemas/food";

export const GRAMS_PER_OUNCE = 28.3495;
export const ML_PER_FLUID_OUNCE = 29.5735;

/** The units a quantity can be logged in. Recipe servings are resolved elsewhere. */
export const quantityUnitSchema = z.enum(["g", "ml", "oz", "fl_oz", "portion"]);

export type QuantityUnit = z.infer<typeof quantityUnitSchema>;

export type ResolvedQuantity = {
  /** The logged quantity in the food's own basis unit: grams for `per_100g`, millilitres for `per_100ml`. */
  amount: number;
  basis: NutrientBasis;
  /** True when the food has no density and 1.0 g/ml was assumed to cross between mass and volume. */
  densityAssumed: boolean;
};

type Dimension = "mass" | "volume";
type Measurement = { dimension: Dimension; value: number };

const ASSUMED_DENSITY_G_PER_ML = 1;

const dimensionOfBasis: Record<NutrientBasis, Dimension> = {
  per_100g: "mass",
  per_100ml: "volume",
};

const measurePortion = (
  quantity: number,
  portion: Pick<FoodPortion, "grams" | "ml"> | undefined,
): Measurement => {
  if (portion === undefined) {
    throw new RangeError("The portion unit needs a portion");
  }
  if (portion.grams !== null && portion.ml === null) {
    return { dimension: "mass", value: quantity * portion.grams };
  }
  if (portion.grams === null && portion.ml !== null) {
    return { dimension: "volume", value: quantity * portion.ml };
  }
  throw new RangeError("A portion needs exactly one of grams and ml");
};

const measure = (
  quantity: number,
  unit: QuantityUnit,
  portion: Pick<FoodPortion, "grams" | "ml"> | undefined,
): Measurement => {
  switch (unit) {
    case "g":
      return { dimension: "mass", value: quantity };
    case "oz":
      return { dimension: "mass", value: quantity * GRAMS_PER_OUNCE };
    case "ml":
      return { dimension: "volume", value: quantity };
    case "fl_oz":
      return { dimension: "volume", value: quantity * ML_PER_FLUID_OUNCE };
    case "portion":
      return measurePortion(quantity, portion);
  }
};

/**
 * Expresses a logged quantity in the food's own basis unit so it can be handed to `scaleNutrients`.
 * Density is used only when the unit and the basis disagree on mass versus volume. A food with no
 * density is treated as 1.0 g/ml and the result is flagged with `densityAssumed`.
 *
 * Throws a `RangeError` for a negative or non-finite quantity, for the `portion` unit without a
 * portion, for a portion that does not have exactly one of `grams` and `ml`, and for a density that
 * is not greater than 0 when the unit and the basis disagree and the density is therefore read.
 */
export const resolveQuantity = (
  item: Pick<Food, "basis" | "density_g_per_ml">,
  quantity: number,
  unit: QuantityUnit,
  portion?: Pick<FoodPortion, "grams" | "ml">,
): ResolvedQuantity => {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a finite number of at least 0, received ${quantity}`);
  }
  const measurement = measure(quantity, unit, portion);
  if (measurement.dimension === dimensionOfBasis[item.basis]) {
    return { amount: measurement.value, basis: item.basis, densityAssumed: false };
  }
  const densityAssumed = item.density_g_per_ml === null;
  const density = item.density_g_per_ml ?? ASSUMED_DENSITY_G_PER_ML;
  if (!(density > 0)) {
    throw new RangeError(`Density must be greater than 0, received ${density}`);
  }
  const amount =
    measurement.dimension === "mass" ? measurement.value / density : measurement.value * density;
  return { amount, basis: item.basis, densityAssumed };
};
