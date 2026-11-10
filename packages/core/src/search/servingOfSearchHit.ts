import { describePortionWithSize } from "../copy/portionPicker";
import { scaleNutrients } from "../nutrition/scale";

import type { Food } from "../schemas/food";
import type { OffCandidatePortion } from "../schemas/off";

export type ServingSource = Pick<Food, "basis" | "kcal" | "protein_g" | "fat_g" | "carbs_g"> & {
  /** The default portion's id and label, or null when the food has none. */
  default_portion_id: string | null;
  default_portion_label: string | null;
  default_portion_grams: number | null;
  default_portion_ml: number | null;
};

export type SearchServing = {
  /** How much of the food the serving is: 1 of the default portion, or 100 g or 100 ml. */
  quantity: number;
  unit: "g" | "ml" | "portion";
  /** The default portion's id when the serving is one, else null. */
  portionId: string | null;
  /** What the serving is: "1 medium (100 g)", or "100 g" or "100 ml" when the food has no default portion. */
  caption: string;
  /** The food's values for the serving. A value the food does not give is null. */
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
};

/** The amount a serving or a chip starts at when it is 100 g or 100 ml. */
export const AMOUNT_OF_THE_BASIS = 100;
/** The amount a serving or a chip starts at when it is a portion or a spoon. */
export const AMOUNT_OF_A_PORTION = 1;

type WholePortion = { label: string; amount: number; unit: "g" | "ml"; id: string | null };
type ServingNutrients = Pick<Food, "basis" | "kcal" | "protein_g" | "fat_g" | "carbs_g">;

/** What a food per portion's one portion is called when the row has no label for it. */
const UNNAMED_PORTION = "portion";

/**
 * The serving a result row of the food log search shows, its plus logs and the portion picker starts at:
 * one of the food's default portion, or 100 of the food's basis (100 g, or 100 ml for a drink) when it has
 * none. The row, the plus and the picker all take it from here, so they cannot drift apart. It reads the lean
 * row the search returns, which carries the default portion but not the food's density, so a portion
 * measured in the other dimension than the food's basis counts as if 1 g were 1 ml. The values are the
 * food's, scaled the way a logged entry's are. A food per portion is always one of its portion, which has no
 * size, so its caption is the portion's label alone, "1 bucket".
 */
export function servingOfSearchHit(hit: ServingSource): SearchServing {
  if (hit.basis === "per_portion") {
    return servingOfPerPortion(hit, hit.default_portion_label, hit.default_portion_id);
  }
  const portion =
    hit.default_portion_id === null
      ? undefined
      : wholePortion(
          hit.default_portion_label,
          hit.default_portion_grams,
          hit.default_portion_ml,
          hit.default_portion_id,
        );

  return servingOf(hit, portion);
}

/**
 * The serving a live Open Food Facts row of the search shows: the same arithmetic and caption as
 * `servingOfSearchHit`, for a product that is not stored yet. The portion it would open on comes with
 * the candidate and has no id, so the serving has no `portionId`. A candidate with no default portion,
 * from a function or a stored answer that predates it, is 100 g or 100 ml.
 */
export function servingOfCandidate(
  candidate: ServingNutrients & { default_portion?: OffCandidatePortion | null | undefined },
): SearchServing {
  const portion = candidate.default_portion;

  return servingOf(
    candidate,
    portion === undefined || portion === null
      ? undefined
      : wholePortion(portion.label, portion.grams, portion.ml, null),
  );
}

function servingOf(food: ServingNutrients, portion: WholePortion | undefined): SearchServing {
  if (food.basis === "per_portion") {
    return servingOfPerPortion(food, portion?.label ?? null, portion?.id ?? null);
  }
  const amount = portion?.amount ?? AMOUNT_OF_THE_BASIS;
  const unit = portion?.unit ?? (food.basis === "per_100ml" ? "ml" : "g");
  const scaled = scaleNutrients(
    {
      kcal: food.kcal,
      protein_g: food.protein_g,
      fat_g: food.fat_g,
      carbs_g: food.carbs_g,
      fibre_g: null,
    },
    amount,
    food.basis,
  );

  return {
    quantity: portion === undefined ? AMOUNT_OF_THE_BASIS : AMOUNT_OF_A_PORTION,
    unit: portion === undefined ? unit : "portion",
    portionId: portion?.id ?? null,
    caption:
      portion === undefined
        ? `${AMOUNT_OF_THE_BASIS} ${unit}`
        : describePortionWithSize(portion.label, { amount, unit }),
    kcal: scaled.kcal,
    protein_g: scaled.protein_g,
    fat_g: scaled.fat_g,
    carbs_g: scaled.carbs_g,
  };
}

// A food per portion is always one of its count portion, which has no size to put in brackets.
function servingOfPerPortion(
  food: ServingNutrients,
  label: string | null,
  id: string | null,
): SearchServing {
  const scaled = scaleNutrients(
    {
      kcal: food.kcal,
      protein_g: food.protein_g,
      fat_g: food.fat_g,
      carbs_g: food.carbs_g,
      fibre_g: null,
    },
    AMOUNT_OF_A_PORTION,
    food.basis,
  );

  return {
    quantity: AMOUNT_OF_A_PORTION,
    unit: "portion",
    portionId: id,
    caption: label ?? `${AMOUNT_OF_A_PORTION} ${UNNAMED_PORTION}`,
    kcal: scaled.kcal,
    protein_g: scaled.protein_g,
    fat_g: scaled.fat_g,
    carbs_g: scaled.carbs_g,
  };
}

// A portion has a label and exactly one of grams and millilitres. Anything less is not a portion to show.
function wholePortion(
  label: string | null,
  grams: number | null,
  ml: number | null,
  id: string | null,
): WholePortion | undefined {
  if (label === null) {
    return undefined;
  }
  if (grams !== null && ml === null) {
    return { label, amount: grams, unit: "g", id };
  }
  if (ml !== null && grams === null) {
    return { label, amount: ml, unit: "ml", id };
  }
  return undefined;
}
