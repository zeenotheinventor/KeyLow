import type { DiaryWeekDay } from "@keylow/api-client";
import type { WeekDayTotals } from "@keylow/core/diary";

/**
 * What a day of the week added up to, as the week's average takes it: null for a day with no entries. A
 * nutrient no entry gave a value for reads as 0, as it does on the day's bars. The Week view and the
 * dashboard's This week card both read a day this way, so their averages cannot disagree.
 */
export function weekDayTotals(totals: DiaryWeekDay["totals"]): WeekDayTotals | null {
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
