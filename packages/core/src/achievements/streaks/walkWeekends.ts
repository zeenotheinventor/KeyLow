import { addCalendarDays, daysSinceMonday } from "../../dates";

const DAYS_FROM_MONDAY_TO_SATURDAY = 5;
const DAYS_PER_WEEK = 7;

/**
 * Consecutive weekends with both Saturday and Sunday counted, from the weekend of the first counted
 * day to the one `today` is in. A weekend still going (nothing missed yet, not both days counted)
 * neither breaks the run nor joins it. A weekend that cannot be completed any more breaks it.
 * Takes the counted days, oldest first, and whether a day is settled.
 */
export function walkWeekends(
  countedDates: string[],
  today: string,
  isSettled: (localDate: string) => boolean,
): { current: number; longest: number } {
  const counted = new Set(countedDates);
  const firstCounted = countedDates[0];
  let current = 0;
  let longest = 0;

  if (firstCounted === undefined) {
    return { current, longest };
  }

  for (
    let saturday = addCalendarDays(
      firstCounted,
      DAYS_FROM_MONDAY_TO_SATURDAY - daysSinceMonday(firstCounted),
    );
    saturday <= today;
    saturday = addCalendarDays(saturday, DAYS_PER_WEEK)
  ) {
    const sunday = addCalendarDays(saturday, 1);
    const saturdayMissed = !counted.has(saturday) && isSettled(saturday);
    const sundayMissed = !counted.has(sunday) && sunday <= today && isSettled(sunday);

    if (counted.has(saturday) && counted.has(sunday)) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (saturdayMissed || sundayMissed) {
      current = 0;
    }
  }

  return { current, longest };
}
