import { formatGrams } from "./numbers";

import type { FoodPortion } from "../schemas/food";

export type PortionAmount = { amount: string; unit: "g" | "ml" };

/**
 * A portion's amount in grams or millilitres, written as grams are. A portion has exactly one of the
 * two, so null is only there for the type.
 */
export const formatPortionAmount = ({
  grams,
  ml,
}: Pick<FoodPortion, "grams" | "ml">): PortionAmount | null => {
  if (grams !== null) {
    return { amount: formatGrams(grams), unit: "g" };
  }
  return ml === null ? null : { amount: formatGrams(ml), unit: "ml" };
};
