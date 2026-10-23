import type { WeekDayTotals } from "./weekAverage";

/** The part of a `day_totals` row the week's average reads: each figure null when no entry gave a value. */
export type WeekDayNutrients = { [Key in keyof WeekDayTotals]: number | null };

/**
 * What a day of the week added up to, as the week's average takes it: null for a day with no entries. A
 * nutrient no entry gave a value for reads as 0, as it does on the day's bars. The web diary's Week view and
 * both apps' dashboard This week cards read a day this way, so their averages cannot disagree.
 */
export function weekDayTotals(totals: WeekDayNutrients | null): WeekDayTotals | null {
  if (totals === null) {
    return null;
  }

  return {
    kcal: totals.kcal ?? 0,
    protein_g: totals.protein_g ?? 0,
    carbs_g: totals.carbs_g ?? 0,
    fat_g: totals.fat_g ?? 0,
  };
}
