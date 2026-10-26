import { validateQuantity } from "../diary/rules/validateQuantity";
import { parseFormNumber } from "../foods/foodForm";

import type { PlateItem, PlateValues } from "./types";
import type { NullableNutrients } from "../schemas/nutrients";

const NO_VALUES: PlateValues = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

/** The plate's four values from nutrients, where a value that is not given counts as 0 (the way a day's total skips it). */
export const plateValuesOf = (
  nutrients: Pick<NullableNutrients, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
): PlateValues => ({
  kcal: nutrients.kcal ?? 0,
  protein_g: nutrients.protein_g ?? 0,
  carbs_g: nutrients.carbs_g ?? 0,
  fat_g: nutrients.fat_g ?? 0,
});

/**
 * What an amount field's text reads as: the number it holds, or 0 when it is not a valid amount. It reads
 * the text as the portion picker does (`parseFormNumber`, then `validateQuantity`), so "1,5" and "1.5" are
 * both one and a half, and an empty, 0, negative or unreadable text is not an amount.
 */
export function parsePlateQuantity(text: string): number {
  const entered = parseFormNumber(text);
  const checked = validateQuantity(entered === undefined ? null : entered);

  return checked.ok ? checked.value : 0;
}

// The row's values, or undefined while the amount is not valid. An amount so large that its values are not
// numbers is not valid either, as in the picker.
function scaledValues(item: PlateItem): PlateValues | undefined {
  if (!(item.quantity > 0)) {
    return undefined;
  }
  const { quantity, perUnit } = item;
  const scaled = {
    kcal: perUnit.kcal * quantity,
    protein_g: perUnit.protein_g * quantity,
    carbs_g: perUnit.carbs_g * quantity,
    fat_g: perUnit.fat_g * quantity,
  };

  return Object.values(scaled).every(Number.isFinite) ? scaled : undefined;
}

/** Whether the row's amount is one that can be logged. */
export const isPlateItemValid = (item: PlateItem): boolean => scaledValues(item) !== undefined;

/** What the row comes to at its amount: 0 across while the amount is not valid. Nothing is rounded. */
export const plateItemValues = (item: PlateItem): PlateValues => scaledValues(item) ?? NO_VALUES;

export type PlateTotals = PlateValues & {
  /** How many rows are on the plate, including a row whose amount is not valid. */
  count: number;
};

/** What the plate comes to. A row whose amount is not valid adds nothing. Rounding is for display only. */
export const plateTotals = (items: readonly PlateItem[]): PlateTotals => {
  const totals: PlateTotals = { count: items.length, ...NO_VALUES };
  for (const item of items) {
    const values = plateItemValues(item);
    totals.kcal += values.kcal;
    totals.protein_g += values.protein_g;
    totals.carbs_g += values.carbs_g;
    totals.fat_g += values.fat_g;
  }

  return totals;
};

/** Whether Log foods can be pressed: there is a food on the plate and every amount is valid. */
export const canLogPlate = (items: readonly PlateItem[]): boolean =>
  items.length > 0 && items.every(isPlateItemValid);
