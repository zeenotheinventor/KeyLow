/** What a day added up to, for the week view. */
export type WeekDayTotals = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type WeekAverageDay = {
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  /** Null when the day has no entries. */
  totals: WeekDayTotals | null;
};

/**
 * The average of a week's days from Monday to today, for the diary's week view alone: the This week card
 * and the weekly averages page leave today out (core `weekCaloriesBeforeToday`). A day after today is
 * left out, and so is a day with no entries: a day that was not tracked is not a day of eating nothing,
 * and counting it would pull the average down. Null when no day is left to average.
 */
export function weekAverage(days: readonly WeekAverageDay[], today: string): WeekDayTotals | null {
  const tracked = days.flatMap((day) =>
    day.localDate <= today && day.totals !== null ? [day.totals] : [],
  );
  if (tracked.length === 0) {
    return null;
  }
  const mean = (pick: (totals: WeekDayTotals) => number): number =>
    tracked.reduce((sum, totals) => sum + pick(totals), 0) / tracked.length;

  return {
    kcal: mean((totals) => totals.kcal),
    protein_g: mean((totals) => totals.protein_g),
    carbs_g: mean((totals) => totals.carbs_g),
    fat_g: mean((totals) => totals.fat_g),
  };
}
