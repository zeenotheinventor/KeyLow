import { NOT_GIVEN } from "../copy/nutrition";
import { spokenAmount } from "../copy/spokenAmount";
import { formatGrams } from "../format/numbers";

import type { Food } from "../schemas/food";

export type MacroDescription = {
  /** The value for the row, written with `formatGrams`, or null when it is not given. Never "0" for a missing value. */
  protein: string | null;
  fat: string | null;
  carbs: string | null;
  /** The macros spelled out for a screen reader, with a missing value read as "not given". */
  accessibleDescription: string;
};

const formatMacro = (grams: number | null): string | null =>
  grams === null ? null : formatGrams(grams);

const spokenMacro = (name: string, formatted: string | null): string =>
  `${name} ${formatted === null ? NOT_GIVEN : spokenAmount(formatted, "gram", "grams")}`;

/**
 * The protein, fat and carbohydrate of a food row as the search rows and food tiles show them,
 * plus a sentence for a screen reader such as "protein 32 grams, fat 2.2 grams, carbohydrate 0
 * grams". Presentational only: it reads the values the row already carries.
 */
export const describeMacros = (
  food: Pick<Food, "protein_g" | "fat_g" | "carbs_g">,
): MacroDescription => {
  const protein = formatMacro(food.protein_g);
  const fat = formatMacro(food.fat_g);
  const carbs = formatMacro(food.carbs_g);
  return {
    protein,
    fat,
    carbs,
    accessibleDescription: [
      spokenMacro("protein", protein),
      spokenMacro("fat", fat),
      spokenMacro("carbohydrate", carbs),
    ].join(", "),
  };
};
