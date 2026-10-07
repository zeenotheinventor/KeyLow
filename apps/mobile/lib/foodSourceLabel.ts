import type { FoodSource } from "@keylow/core/schemas";

const FOOD_SOURCE_LABELS: Record<FoodSource, string> = {
  user: "Own food",
  cofid: "CoFID",
  off: "Open Food Facts",
};

/** The name of where a food came from, as shown to the user. */
export function foodSourceLabel(source: FoodSource): string {
  return FOOD_SOURCE_LABELS[source];
}
