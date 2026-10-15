import { spoonPortionWithLabel } from "../nutrition/volume";

import type { SnapshotPortion } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { SpoonPortion } from "../nutrition/volume";
import type { FoodPortion } from "../schemas/food";

/** What an entry logged with a portion remembers about it. */
export type LoggedPortion = {
  quantity: number;
  portionId: string | null;
  portion: SnapshotPortion;
};

export type MatchedAmount =
  | { quantity: number; unit: "portion"; portion: FoodPortion | SpoonPortion }
  | { quantity: number; unit: Extract<QuantityUnit, "g" | "ml">; portion?: undefined };

/**
 * Finds where a portion-sized amount lands on the live food's portions, for "Update to current food
 * data" and for "log again". In order: the portion the link still points to, a portion with the same
 * label, the teaspoon or tablespoon when the old portion was one (a spoon is not a row, so no link could
 * point to it), and finally a direct amount in the unit of the old portion (grams for a gram portion,
 * millilitres for a millilitre portion), so the logged amount is kept exactly. A portion is a spoon only
 * when it is in millilitres and has the spoon's label and size, so a gram portion that merely shares a
 * spoon's label keeps its grams. The count of portions is kept for the first three. The food's default
 * portion is deliberately not a step, because it could be a different size and silently change what was logged.
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
  const spoon = spoonPortionWithLabel(previous.portion.label);
  if (spoon !== undefined && "ml" in previous.portion && previous.portion.ml === spoon.ml) {
    return { quantity: previous.quantity, unit: "portion", portion: spoon };
  }
  return "grams" in previous.portion
    ? { quantity: previous.quantity * previous.portion.grams, unit: "g" }
    : { quantity: previous.quantity * previous.portion.ml, unit: "ml" };
};
