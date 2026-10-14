import { ENERGY_NOT_GIVEN, describeBasis } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { describeMacros, highlightMatch } from "@keylow/core/search";

import type { FoodRowProps } from "../ui";
import type { Food } from "@keylow/core/schemas";

type FoodLike = Pick<Food, "name" | "brand" | "kcal" | "basis" | "protein_g" | "fat_g" | "carbs_g">;

// A macro the source does not state is not a zero, so it gets a dash in its place.
const MACRO_NOT_GIVEN = "-";

/** What a `FoodRow` shows for a food or an Open Food Facts candidate, with the query's words in bold. */
export function toFoodRowProps(food: FoodLike, query: string): Omit<FoodRowProps, "onPress"> {
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
}
