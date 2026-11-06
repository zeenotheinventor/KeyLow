import { amountInPickerUnits } from "./amountInPickerUnits";
import { matchPortionOnFood } from "./matchPortionOnFood";

import type { ChosenAmount } from "./previewAmount";
import type { FoodSnapshot } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { SpoonPortion } from "../nutrition/volume";
import type { FoodPortion } from "../schemas/food";

/** What a food's last entry remembers of its amount: the snapshot, and the portion the entry pointed to. */
export type LastLoggedFood = {
  /** The portion that entry used, null once the portion was replaced or when the unit was not `portion`. */
  portionId: string | null;
  snapshot: FoodSnapshot;
};

/** An amount of a food to log: a count of one of its portions, or a measured amount. */
export type LoggableAmount =
  | { quantity: number; unit: Exclude<QuantityUnit, "portion"> }
  | { quantity: number; unit: "portion"; portion: FoodPortion | SpoonPortion };

/**
 * The amount a Recent food was last logged with, to log it again against the food as it is now. A portion
 * is looked up by `matchPortionOnFood`, which falls back to the grams or millilitres it came to when
 * the portion has been replaced, so the amount eaten is kept exactly.
 */
export function amountLastLogged(
  recent: LastLoggedFood,
  portions: readonly FoodPortion[],
): LoggableAmount {
  const { snapshot } = recent;
  if (snapshot.unit === "portion" && snapshot.portion !== null) {
    return matchPortionOnFood(
      { quantity: snapshot.quantity, portionId: recent.portionId, portion: snapshot.portion },
      portions,
    );
  }
  if (snapshot.unit === "portion") {
    return { quantity: snapshot.resolvedGrams, unit: "g" };
  }

  return { quantity: snapshot.quantity, unit: snapshot.unit };
}

/** The same amount in the units the portion picker offers, which are portions, grams and millilitres. */
export function amountForPicker(amount: LoggableAmount): ChosenAmount<FoodPortion | SpoonPortion> {
  return amount.unit === "portion" ? amount : amountInPickerUnits(amount);
}
