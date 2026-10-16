import { PORTION_PICKER, describeAmountBasis, describeVolumeBasis } from "../copy/portionPicker";
import { parseFormNumber } from "../foods/foodForm";
import { scaleNutrients } from "../nutrition/scale";
import { resolveQuantity } from "../nutrition/units";
import { densityForLogging, isSpoonPortionId } from "../nutrition/volume";
import { validateQuantity } from "./rules/validateQuantity";

import type { Food, FoodPortion } from "../schemas/food";

/** The part of a portion an amount needs: its id (what a unit chip carries), its label and its size. */
export type AmountPortion = Pick<FoodPortion, "id" | "label" | "grams" | "ml">;

/**
 * An amount of a food: a count of one of its portions, or grams, or millilitres. The portion keeps the type
 * the caller gave, so a screen that holds whole portions gets whole portions back.
 */
export type ChosenAmount<Portion extends AmountPortion = AmountPortion> =
  { unit: "g" | "ml"; quantity: number } | { unit: "portion"; quantity: number; portion: Portion };

/**
 * The part of a food an amount is worked out from. A logged entry's snapshot gives the same, see
 * `snapshotAsFood`. A food row also gives its source and group, which a density estimate is made from, so a
 * volume amount is worked out with the density a logged entry would freeze. A snapshot has already frozen it.
 */
export type AmountFood = Pick<
  Food,
  "basis" | "density_g_per_ml" | "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g"
> &
  Partial<Pick<Food, "source" | "source_ref" | "food_group">>;

/** What an amount comes to: the values for it and the caption that says what it is, such as "For 150 g". Values are null while there is no valid amount. */
export type AmountSummary = {
  caption: string;
  values: Pick<Food, "kcal" | "protein_g" | "carbs_g" | "fat_g"> | null;
};

const NO_AMOUNT: AmountSummary = { caption: PORTION_PICKER.noAmountBasis, values: null };

export type AmountPreview<Portion extends AmountPortion = AmountPortion> = {
  /** The amount the text and the chosen unit make, or null while it is not a number above 0. */
  amount: ChosenAmount<Portion> | null;
  /** What the hero draws for it: the scaled values and the caption, or dashes with no amount. */
  hero: AmountSummary;
};

function sizeOf(portion: AmountPortion): { amount: number; unit: "g" | "ml" } {
  return portion.grams === null
    ? { amount: portion.ml ?? 0, unit: "ml" }
    : { amount: portion.grams, unit: "g" };
}

function amountOf<Portion extends AmountPortion>(
  unitValue: string,
  portions: readonly Portion[],
  quantity: number,
): ChosenAmount<Portion> | undefined {
  if (unitValue === "g" || unitValue === "ml") {
    return { unit: unitValue, quantity };
  }
  const portion = portions.find((candidate) => candidate.id === unitValue);

  return portion === undefined ? undefined : { unit: "portion", quantity, portion };
}

// The density `buildLogEntry` freezes for the food, so the hero and the entry it makes agree to the digit.
const densityOf = (food: AmountFood): number | null =>
  densityForLogging({
    density_g_per_ml: food.density_g_per_ml,
    source: food.source ?? "user",
    source_ref: food.source_ref ?? null,
    food_group: food.food_group ?? null,
  });

function weightOf(amount: ChosenAmount, density: number | null): number | null {
  if (density === null) {
    return null;
  }

  return resolveQuantity(
    { basis: "per_100g", density_g_per_ml: density },
    amount.quantity,
    amount.unit,
    amount.unit === "portion" ? amount.portion : undefined,
  ).amount;
}

function captionOf(amount: ChosenAmount, density: number | null): string {
  if (amount.unit === "ml") {
    return describeVolumeBasis({
      unit: "ml",
      quantity: amount.quantity,
      weightInGrams: weightOf(amount, density),
    });
  }
  if (amount.unit !== "portion") {
    return describeAmountBasis(amount);
  }
  if (isSpoonPortionId(amount.portion.id)) {
    return describeVolumeBasis({
      unit: "spoon",
      quantity: amount.quantity,
      spoonLabel: amount.portion.label,
      volumeMl: amount.quantity * (amount.portion.ml ?? 0),
      weightInGrams: weightOf(amount, density),
    });
  }
  return describeAmountBasis({
    unit: "portion",
    quantity: amount.quantity,
    portionLabel: amount.portion.label,
    portionSize: sizeOf(amount.portion),
  });
}

/**
 * What the picker's hero shows for the text in the amount field and the chosen unit. The values are the
 * food's own, scaled the way a logged entry's are (`resolveQuantity` and `scaleNutrients`), so the hero
 * and the entry agree. Text that is not a number above 0, a unit the food no longer has and an amount too
 * large to work out all give no amount and the dashes, never an error.
 */
export function previewAmount<Portion extends AmountPortion>(
  food: AmountFood,
  portions: readonly Portion[],
  unitValue: string,
  quantityText: string,
): AmountPreview<Portion> {
  const entered = parseFormNumber(quantityText);
  const quantity = validateQuantity(entered === undefined ? null : entered);
  if (!quantity.ok) {
    return { amount: null, hero: NO_AMOUNT };
  }

  const amount = amountOf(unitValue, portions, quantity.value);
  if (amount === undefined) {
    return { amount: null, hero: NO_AMOUNT };
  }

  try {
    const density = densityOf(food);
    const { amount: inBasisUnit } = resolveQuantity(
      { basis: food.basis, density_g_per_ml: density },
      amount.quantity,
      amount.unit,
      amount.unit === "portion" ? amount.portion : undefined,
    );
    const { kcal, protein_g, carbs_g, fat_g } = scaleNutrients(
      {
        kcal: food.kcal,
        protein_g: food.protein_g,
        fat_g: food.fat_g,
        carbs_g: food.carbs_g,
        fibre_g: food.fibre_g,
      },
      inBasisUnit,
    );

    return {
      amount,
      hero: { caption: captionOf(amount, density), values: { kcal, protein_g, carbs_g, fat_g } },
    };
  } catch (error) {
    // Core refuses an amount that overflows. The message quotes it, so it is not kept: the amount is health data.
    if (error instanceof RangeError) {
      return { amount: null, hero: NO_AMOUNT };
    }
    throw error;
  }
}
