import { previousCalendarDay } from "../../dates";
import { dayNumber } from "../../dates/calendarDay";

const DAYS_OFF_BEFORE_BACK_ON_TRACK = 3;

/**
 * Whether a counted day ever came after 3 or more days off in a row. The first counted day follows
 * no days off, and a frozen day is still a day off. A day off only counts once it is settled, so the
 * answer never turns back to false when the last day off is completed inside its window. Takes the
 * counted days, oldest first.
 */
export function hasBackOnTrack(
  countedDates: string[],
  isSettled: (localDate: string) => boolean,
): boolean {
  return countedDates.some((localDate, at) => {
    const previous = countedDates[at - 1];
    return (
      previous !== undefined &&
      dayNumber(localDate) - dayNumber(previous) - 1 >= DAYS_OFF_BEFORE_BACK_ON_TRACK &&
      isSettled(previousCalendarDay(localDate))
    );
  });
}
