import type { SnapshotPortion } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { FoodPortion } from "../schemas/food";

/** What an entry logged with a portion remembers about it. */
export type LoggedPortion = {
  quantity: number;
  portionId: string | null;
  portion: SnapshotPortion;
};

export type MatchedAmount =
  | { quantity: number; unit: "portion"; portion: FoodPortion }
  | { quantity: number; unit: Extract<QuantityUnit, "g" | "ml">; portion?: undefined };

/**
 * Finds where a portion-sized amount lands on the live food's portions, for "Update to current food
 * data" and for "log again". In order: the portion the link still points to, a portion with the same
 * label, and finally a direct amount in the unit of the old portion (grams for a gram portion,
 * millilitres for a millilitre portion), so the logged amount is kept exactly. The count of portions
 * is kept for the first two. The food's default portion is deliberately not a step, because it
 * could be a different size and silently change what was logged.
 */
export const matchPortionOnFood = (
  previous: LoggedPortion,
  portions: readonly FoodPortion[],
): MatchedAmount => {
  const match =
    portions.find((portion) => previous.portionId !== null && portion.id === previous.portionId) ??
    portions.find((portion) => portion.label === previous.portion.label);
  if (match !== undefined) {
    return { quantity: previous.quantity, unit: "portion", portion: match };
  }
  return "grams" in previous.portion
    ? { quantity: previous.quantity * previous.portion.grams, unit: "g" }
    : { quantity: previous.quantity * previous.portion.ml, unit: "ml" };
};
