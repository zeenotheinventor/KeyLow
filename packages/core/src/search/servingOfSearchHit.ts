import { describePortionWithSize } from "../copy/portionPicker";
import { scaleNutrients } from "../nutrition/scale";

import type { Food } from "../schemas/food";

export type ServingSource = Pick<Food, "basis" | "kcal" | "protein_g" | "fat_g" | "carbs_g"> & {
  /** The default portion's label, or null when the food has none. */
  default_portion_label: string | null;
  default_portion_grams: number | null;
  default_portion_ml: number | null;
};

export type SearchServing = {
  /** What the serving is: "1 medium (100 g)", or "100 g" or "100 ml" when the food has no default portion. */
  caption: string;
  /** The food's values for the serving. A value the food does not give is null. */
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
};

const AMOUNT_OF_THE_BASIS = 100;

/**
 * The serving a result row of the food log search shows and its plus logs: one of the food's default
 * portion, or 100 of the food's basis (100 g, or 100 ml for a drink) when it has none. It reads the lean
 * row the search returns, which carries the default portion but not the food's density, so a portion
 * measured in the other dimension than the food's basis counts as if 1 g were 1 ml. The values are the
 * food's, scaled the way a logged entry's are.
 */
export function servingOfSearchHit(hit: ServingSource): SearchServing {
  const portionSize = wholePortionSize(hit);
  const amount = portionSize?.amount ?? AMOUNT_OF_THE_BASIS;
  const unit = portionSize?.unit ?? (hit.basis === "per_100ml" ? "ml" : "g");
  const scaled = scaleNutrients(
    {
      kcal: hit.kcal,
      protein_g: hit.protein_g,
      fat_g: hit.fat_g,
      carbs_g: hit.carbs_g,
      fibre_g: null,
    },
    amount,
  );

  return {
    caption:
      portionSize === undefined || hit.default_portion_label === null
        ? `${AMOUNT_OF_THE_BASIS} ${unit}`
        : describePortionWithSize(hit.default_portion_label, portionSize),
    kcal: scaled.kcal,
    protein_g: scaled.protein_g,
    fat_g: scaled.fat_g,
    carbs_g: scaled.carbs_g,
  };
}

// A portion has a label and exactly one of grams and millilitres. Anything less is not a portion to show.
function wholePortionSize(hit: ServingSource): { amount: number; unit: "g" | "ml" } | undefined {
  if (hit.default_portion_label === null) {
    return undefined;
  }
  if (hit.default_portion_grams !== null && hit.default_portion_ml === null) {
    return { amount: hit.default_portion_grams, unit: "g" };
  }
  if (hit.default_portion_ml !== null && hit.default_portion_grams === null) {
    return { amount: hit.default_portion_ml, unit: "ml" };
  }
  return undefined;
}
