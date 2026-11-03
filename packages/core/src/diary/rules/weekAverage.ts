import { loggedDaysBeforeToday } from "./loggedDaysBeforeToday";

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

/** What the diary's week view shows for the week's average, and why when it shows no number. */
export type WeekAverage =
  | {
      kind: "average";
      /** The mean of the days logged before today. */
      totals: WeekDayTotals;
      /** How many days it is the mean of. */
      daysLogged: number;
    }
  /** Today is the week's Monday, so no earlier day of the week is there to average. */
  | { kind: "startsTomorrow" }
  /** The week holds today, and no day before it has anything logged. */
  | { kind: "nothingBeforeToday" }
  /** A past week or a week to come with nothing logged. */
  | { kind: "noEntries" };

/**
 * The average of a week's days for the diary's week view, over the same days as the This week card and the
 * weekly averages page: the days before today that have entries (see `loggedDaysBeforeToday`). When there
 * is none, the kind says why. The Monday state comes from the week, not from today alone: only a week
 * that starts today starts tomorrow, and a past week viewed on a later Monday counts all its days.
 */
export function weekAverage(days: readonly WeekAverageDay[], today: string): WeekAverage {
  if (days[0]?.localDate === today) {
    return { kind: "startsTomorrow" };
  }
  const logged = loggedDaysBeforeToday(days, today);
  if (logged.length === 0) {
    return days.some((day) => day.localDate === today)
      ? { kind: "nothingBeforeToday" }
      : { kind: "noEntries" };
  }
  const mean = (pick: (totals: WeekDayTotals) => number): number =>
    logged.reduce((sum, totals) => sum + pick(totals), 0) / logged.length;

  return {
    kind: "average",
    daysLogged: logged.length,
    totals: {
      kcal: mean((totals) => totals.kcal),
      protein_g: mean((totals) => totals.protein_g),
      carbs_g: mean((totals) => totals.carbs_g),
      fat_g: mean((totals) => totals.fat_g),
    },
  };
}
