import { addCalendarDays, toLocalDate } from "@keylow/core/dates";

const DAYS_PER_WEEK = 7;

/**
 * The first day a program history of `weeks` weeks reads from: the day `weeks` whole weeks before today
 * in the user's zone, `YYYY-MM-DD`. `now` is an ISO timestamp with a zone.
 */
export function programHistoryFromDate(weeks: number, now: string, timeZone: string): string {
  return addCalendarDays(toLocalDate(new Date(now), timeZone), -weeks * DAYS_PER_WEEK);
}
