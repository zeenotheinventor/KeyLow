import type { NullableNutrients } from "../../schemas";

/** The part of a `food_log_entries` row a day's totals are made from. */
export type SummableEntry = {
  nutrients: NullableNutrients;
  deleted_at?: string | null;
};

/** Every nutrient a day adds up, each null when no entry gave a value for it. */
export type EntryTotals = Required<NullableNutrients>;

/**
 * Adds up the nutrients of a day's entries, the same rule `day_totals` follows. An entry with
 * `deleted_at` set is left out. A null (or absent) value is skipped, so it neither adds nor makes
 * the sum unknown, and a key is null only when no live entry gave a value for it.
 *
 * Unlike sumNutrients, a null is skipped and an empty list gives nulls. This is the day_totals rule.
 */
export const sumEntries = (entries: readonly SummableEntry[]): EntryTotals => {
  const live = entries.filter(
    (entry) => entry.deleted_at === null || entry.deleted_at === undefined,
  );
  const sumKey = (key: keyof EntryTotals): number | null => {
    let total: number | null = null;
    for (const entry of live) {
      const value = entry.nutrients[key];
      if (value !== null && value !== undefined) {
        total = (total ?? 0) + value;
      }
    }
    return total;
  };

  return {
    kcal: sumKey("kcal"),
    protein_g: sumKey("protein_g"),
    fat_g: sumKey("fat_g"),
    carbs_g: sumKey("carbs_g"),
    fibre_g: sumKey("fibre_g"),
    sat_fat_g: sumKey("sat_fat_g"),
    sugars_g: sumKey("sugars_g"),
    salt_g: sumKey("salt_g"),
  };
};
