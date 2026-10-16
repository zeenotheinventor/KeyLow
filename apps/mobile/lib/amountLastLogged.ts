import { amountInPickerUnits, matchPortionOnFood } from "@keylow/core/diary";

import type { PortionAmount } from "../components/PortionPicker";
import type { RecentFood } from "@keylow/api-client";
import type { QuantityUnit, SpoonPortion } from "@keylow/core/nutrition";
import type { FoodPortion } from "@keylow/core/schemas";

/** An amount of a food to log: a count of one of its portions, or a measured amount. */
export type LoggableAmount =
  | { quantity: number; unit: Exclude<QuantityUnit, "portion"> }
  | { quantity: number; unit: "portion"; portion: FoodPortion | SpoonPortion };

/**
 * The amount a Recent food was last logged with, to log it again against the food as it is now. A portion
 * is looked up by core's `matchPortionOnFood`, which falls back to the grams or millilitres it came to when
 * the portion has been replaced, so the amount eaten is kept exactly.
 */
export function amountLastLogged(
  recent: RecentFood,
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
export function amountForPicker(amount: LoggableAmount): PortionAmount {
  return amount.unit === "portion" ? amount : amountInPickerUnits(amount);
}
