/**
 * The totals of the days a week's averages are taken over: a day before today that has entries. Today is
 * left out because it is not over yet, a day after it is left out, and so is a day with nothing logged,
 * because a day that was not tracked is not a day of eating nothing. The diary's week view, the This week
 * card and the weekly averages page all take their days from here, so the three cannot disagree.
 */
export function loggedDaysBeforeToday<Totals>(
  days: readonly { localDate: string; totals: Totals | null }[],
  today: string,
): Totals[] {
  return days.flatMap((day) => (day.localDate < today && day.totals !== null ? [day.totals] : []));
}
