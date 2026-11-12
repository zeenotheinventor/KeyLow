import type { FoodSource } from "../schemas/food";

const FOOD_SOURCE_NAMES: Readonly<Record<FoodSource, string>> = {
  off: "Open Food Facts",
  cofid: "UK CoFID",
  usda: "USDA",
  restaurant: "Restaurant",
  user: "Yours",
};

/** Sources are named plainly, as the design system's voice rule says: Open Food Facts, UK CoFID, USDA, Restaurant, Yours. */
export const describeFoodSource = (source: FoodSource): string => FOOD_SOURCE_NAMES[source];
