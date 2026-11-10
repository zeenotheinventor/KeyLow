import { NUTRITION_ENGINE_VERSION } from "./versions";
import { scaleNutrients } from "../nutrition/scale";
import { resolveQuantity } from "../nutrition/units";

import type { FoodSnapshot, SnapshotPortion } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { NullableNutrients } from "../schemas/nutrients";

/** The part of a snapshot that is the food, as opposed to how much of it was logged. */
export type FrozenFood = Omit<
  FoodSnapshot,
  "quantity" | "unit" | "portion" | "resolvedGrams" | "engineVersion"
>;

export type SnapshotQuantity = {
  quantity: number;
  unit: QuantityUnit;
  /** Read only when the unit is `portion`, and ignored for every other unit. */
  portion?: SnapshotPortion | null;
};

const asMeasurablePortion = (portion: SnapshotPortion) => ({
  grams: "grams" in portion ? portion.grams : null,
  ml: "ml" in portion ? portion.ml : null,
});

// The grams a quantity comes to, and 0 for a food per portion: it has no weight, and only a count of its
// portion is a quantity (`resolveQuantity` refuses the rest).
const gramsOf = (
  food: FrozenFood,
  change: SnapshotQuantity,
  measurablePortion: ReturnType<typeof asMeasurablePortion> | undefined,
): number => {
  const { amount } = resolveQuantity(
    {
      basis: food.basis === "per_portion" ? "per_portion" : "per_100g",
      density_g_per_ml: food.density,
    },
    change.quantity,
    change.unit,
    measurablePortion,
  );
  return food.basis === "per_portion" ? 0 : amount;
};

/**
 * The only place a quantity becomes grams: it resolves the quantity against the frozen food, as a
 * per 100 g food so the answer is always grams, using the snapshot's own density. A food per portion has
 * no weight, so its grams are 0.
 *
 * Throws a `RangeError` for a negative quantity or a `portion` unit without a portion, and for a food per
 * portion for any unit but `portion`.
 */
export const withQuantity = (food: FrozenFood, change: SnapshotQuantity): FoodSnapshot => {
  const portion = change.unit === "portion" ? (change.portion ?? null) : null;
  const measurablePortion = portion === null ? undefined : asMeasurablePortion(portion);
  return {
    ...food,
    quantity: change.quantity,
    unit: change.unit,
    portion,
    resolvedGrams: gramsOf(food, change, measurablePortion),
    engineVersion: NUTRITION_ENGINE_VERSION,
  };
};

/**
 * Rebuilds `nutrients` from a snapshot alone: the snapshot's basis, density, quantity, unit and
 * portion are resolved, then its `per100` is scaled. No food row is read, so the answer cannot change
 * when the food does. Nothing is rounded.
 */
export const nutrientsOfSnapshot = (snapshot: FoodSnapshot): NullableNutrients => {
  const { amount } = resolveQuantity(
    { basis: snapshot.basis, density_g_per_ml: snapshot.density },
    snapshot.quantity,
    snapshot.unit,
    snapshot.portion === null ? undefined : asMeasurablePortion(snapshot.portion),
  );
  return scaleNutrients(snapshot.per100, amount, snapshot.basis);
};
