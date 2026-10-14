import { describeMacros } from "./describeMacros";
import { highlightMatch } from "./highlightMatch";
import { ENERGY_NOT_GIVEN, describeBasis } from "../copy/nutrition";
import { formatCalories } from "../format/numbers";

import type { HighlightSegment } from "./highlightMatch";
import type { Food } from "../schemas/food";

export type FoodRowSource = Pick<
  Food,
  "name" | "brand" | "kcal" | "basis" | "protein_g" | "fat_g" | "carbs_g"
>;

export type FoodRowDescription = {
  /** The name cut into the parts that match the query and the parts that do not. */
  nameSegments: HighlightSegment[];
  brand?: string;
  /** The energy in kcal, written with `formatCalories`. Left out when the food has none. */
  energy?: string;
  /** The macros in grams, with a sentence for a screen reader. Left out when the food has no energy. */
  macros?: { protein: string; carbs: string; fat: string; description: string };
  /** What the macros are per, such as "per 100 ml". Left out when it is 100 g. */
  basis?: string;
  /** Takes the place of the macros: "Energy not given". */
  note?: string;
};

// A macro the source does not state is not a zero, so it gets a dash in its place.
const MACRO_NOT_GIVEN = "-";

/**
 * What a food row shows for a food or an Open Food Facts candidate, as plain text for both apps
 * to hand to their own row component: the name with the query's words marked, the brand, the
 * energy and macros, and the basis when it is not 100 g. A food with no energy gets the note
 * "Energy not given" in place of the energy and macros. Absent parts are left out of the result,
 * not set to undefined.
 */
export const describeFoodRow = (food: FoodRowSource, query: string): FoodRowDescription => {
  const nameSegments = highlightMatch(food.name, query);
  const brand = food.brand === null ? {} : { brand: food.brand };
  const basis = food.basis === "per_100g" ? {} : { basis: describeBasis(food.basis) };

  if (food.kcal === null) {
    return { nameSegments, ...brand, ...basis, note: ENERGY_NOT_GIVEN };
  }

  const macros = describeMacros(food);

  return {
    nameSegments,
    ...brand,
    energy: formatCalories(food.kcal),
    macros: {
      protein: macros.protein ?? MACRO_NOT_GIVEN,
      carbs: macros.carbs ?? MACRO_NOT_GIVEN,
      fat: macros.fat ?? MACRO_NOT_GIVEN,
      description: macros.accessibleDescription,
    },
    ...basis,
  };
};
