import type { NullableNutrients } from "../schemas/nutrients";

const optionalKeys = ["sat_fat_g", "sugars_g", "salt_g"] as const;

/**
 * Scales per 100 values to a logged amount: every present nutrient is multiplied by `amount / 100`.
 * The amount is already in the food's basis unit, as returned by `resolveQuantity`. No rounding
 * happens here, the full float is kept and only the UI rounds. A null stays null (unknown is not
 * zero) and an absent optional key stays absent.
 *
 * Throws a `RangeError` for a negative or non-finite amount.
 */
export const scaleNutrients = (per100: NullableNutrients, amount: number): NullableNutrients => {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`Amount must be a finite number of at least 0, received ${amount}`);
  }
  const factor = amount / 100;
  const scaleValue = (value: number | null) => (value === null ? null : value * factor);
  const scaled: NullableNutrients = {
    kcal: scaleValue(per100.kcal),
    protein_g: scaleValue(per100.protein_g),
    fat_g: scaleValue(per100.fat_g),
    carbs_g: scaleValue(per100.carbs_g),
    fibre_g: scaleValue(per100.fibre_g),
  };
  for (const key of optionalKeys) {
    const value = per100[key];
    if (value !== undefined) {
      scaled[key] = scaleValue(value);
    }
  }
  return scaled;
};

/**
 * Adds nutrients across items, key by key, with no rounding. A null is unknown, so a key is null
 * when ANY item has it null (unknown plus known is unknown, never silently 0). For an optional
 * key, an absent value counts as unknown too, and the key is left absent only when every item
 * leaves it absent. The sum of an empty list is 0 for the five required keys and omits the optional keys.
 * Not the day_totals rule, which skips a null: see sumEntries.
 */
export const sumNutrients = (items: readonly NullableNutrients[]): NullableNutrients => {
  const sumKey = (read: (item: NullableNutrients) => number | null | undefined) => {
    let total = 0;
    for (const item of items) {
      const value = read(item);
      if (value === null || value === undefined) {
        return null;
      }
      total += value;
    }
    return total;
  };
  const summed: NullableNutrients = {
    kcal: sumKey((item) => item.kcal),
    protein_g: sumKey((item) => item.protein_g),
    fat_g: sumKey((item) => item.fat_g),
    carbs_g: sumKey((item) => item.carbs_g),
    fibre_g: sumKey((item) => item.fibre_g),
  };
  for (const key of optionalKeys) {
    if (items.some((item) => item[key] !== undefined)) {
      summed[key] = sumKey((item) => item[key]);
    }
  }
  return summed;
};
