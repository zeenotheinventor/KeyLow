import { addCalendarDays } from "./calendarDay";

/** The calendar day before `localDate`, both as `YYYY-MM-DD`. Pure: a calendar day has no time zone. */
export function previousCalendarDay(localDate: string): string {
  return addCalendarDays(localDate, -1);
}
