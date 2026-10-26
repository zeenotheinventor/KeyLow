import type { PlateItem } from "./types";

/** What a row calls itself: the food's name, or the recipe's. */
export const plateItemName = (item: PlateItem): string =>
  item.kind === "food" ? item.name : item.recipe.name;
