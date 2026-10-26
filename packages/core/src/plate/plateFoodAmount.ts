import { isPlateItemValid } from "./plateValues";
import { matchPortionOnFood } from "../diary/matchPortionOnFood";

import type { PlateFoodItem } from "./types";
import type { MatchedAmount } from "../diary/matchPortionOnFood";
import type { FoodPortion } from "../schemas/food";

/**
 * The amount to log a plate row against the food as it is now. A portion is found by its id, else by its
 * label, else (a spoon being the one portion that is no row of the food) as the spoon, else as the same weight in
 * grams or volume in millilitres from the size the row stored, so the amount eaten is kept. This is core's
 * `matchPortionOnFood`, the rule "log again" follows, and it is the same idea as `servingOfHit`'s fallback.
 * Undefined while the row's amount is not valid: nothing is logged for it.
 */
export function plateFoodAmount(
  item: PlateFoodItem,
  portions: readonly FoodPortion[],
): MatchedAmount | undefined {
  if (!isPlateItemValid(item)) {
    return undefined;
  }
  const { unit, quantity } = item;
  if (unit.kind !== "portion") {
    return { quantity, unit: unit.kind };
  }

  return matchPortionOnFood(
    {
      quantity,
      portionId: unit.portionId,
      portion:
        unit.size.unit === "g"
          ? { label: unit.label, grams: unit.size.amount }
          : { label: unit.label, ml: unit.size.amount },
    },
    portions,
  );
}
