import { PORTION_PICKER, describeAmountBasis } from "@keylow/core/copy";
import { validateQuantity } from "@keylow/core/diary";
import { parseFormNumber } from "@keylow/core/foods";
import { resolveQuantity, scaleNutrients } from "@keylow/core/nutrition";

import type { PortionAmount } from "./types";
import type { MacroHeroAmount } from "../FoodDetail/MacroHero";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const NO_AMOUNT: MacroHeroAmount = { caption: PORTION_PICKER.noAmountBasis, values: null };

export type AmountPreview = {
  /** The amount the text and the chosen unit make, or null while it is not a number above 0. */
  amount: PortionAmount | null;
  /** What the hero draws for it: the scaled values and the caption, or dashes with no amount. */
  hero: MacroHeroAmount;
};

function sizeOf(portion: FoodPortion): { amount: number; unit: "g" | "ml" } {
  return portion.grams === null
    ? { amount: portion.ml ?? 0, unit: "ml" }
    : { amount: portion.grams, unit: "g" };
}

function amountOf(
  unitValue: string,
  portions: readonly FoodPortion[],
  quantity: number,
): PortionAmount | undefined {
  if (unitValue === "g" || unitValue === "ml") {
    return { unit: unitValue, quantity };
  }
  const portion = portions.find((candidate) => candidate.id === unitValue);

  return portion === undefined ? undefined : { unit: "portion", quantity, portion };
}

function captionOf(amount: PortionAmount): string {
  if (amount.unit !== "portion") {
    return describeAmountBasis(amount);
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
export function previewAmount(
  food: Food,
  portions: readonly FoodPortion[],
  unitValue: string,
  quantityText: string,
): AmountPreview {
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
    const { amount: inBasisUnit } = resolveQuantity(
      food,
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
      hero: { caption: captionOf(amount), values: { kcal, protein_g, carbs_g, fat_g } },
    };
  } catch (error) {
    // Core refuses an amount that overflows. The message quotes it, so it is not kept: the amount is health data.
    if (error instanceof RangeError) {
      return { amount: null, hero: NO_AMOUNT };
    }
    throw error;
  }
}
