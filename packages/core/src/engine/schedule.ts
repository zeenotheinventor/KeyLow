import { addCalendarDays, daysSinceMonday, isValidTimeZone, toLocalDate } from "../dates";

/** The two settling weeks: the first check-in is this many days after the schedule is set (Q1). */
const DAYS_TO_FIRST_CHECKIN = 14;

/** A check-in every week after that, and one for each week a user missed (Q2). */
const DAYS_BETWEEN_CHECKINS = 7;

/** The zone a missing or unknown time zone name is read as. */
const FALLBACK_TIME_ZONE = "UTC";

/** The first check-in of a schedule set on `startedOn` (`YYYY-MM-DD`): 14 days later. */
export function firstCheckinDate(startedOn: string): string {
  return addCalendarDays(startedOn, DAYS_TO_FIRST_CHECKIN);
}

/** The check-in weekday of a schedule set on `startedOn`: ISO 1 (Monday) to 7 (Sunday). */
export function checkinWeekday(startedOn: string): number {
  return daysSinceMonday(startedOn) + 1;
}

/**
 * Every check-in date from `nextCheckinDate` in steps of 7 days that is on or before `today`, oldest first
 * (ADR 0002, Amendment 2, "Catch-up"). One date for each week, so a user back after three missed weeks gets
 * three. Empty when nothing is due. All three are `YYYY-MM-DD` dates in the user's local calendar.
 */
export function dueCheckinDates(nextCheckinDate: string, today: string): string[] {
  const due: string[] = [];
  for (let date = nextCheckinDate; date <= today; date = nextAfter(date)) {
    due.push(date);
  }
  return due;
}

/** The check-in after the one on `asOfDate`: 7 days later. */
export function nextAfter(asOfDate: string): string {
  return addCalendarDays(asOfDate, DAYS_BETWEEN_CHECKINS);
}

/**
 * The user's today, as a `YYYY-MM-DD` date in their time zone (ADR 0002, Amendment 2, "The schedule").
 * A null zone and a name that is not a valid IANA zone are read as UTC. The instant is an argument, so this
 * reads no clock. Throws a `RangeError` that holds no value when `nowIso` is not a time.
 */
export function localToday(nowIso: string, timeZone: string | null): string {
  const zone = timeZone !== null && isValidTimeZone(timeZone) ? timeZone : FALLBACK_TIME_ZONE;
  return toLocalDate(new Date(nowIso), zone);
}

/** The schedule to store: the program's next check-in date and the profile's check-in weekday. */
export type ScheduleToSet = Readonly<{
  nextCheckinDate: string;
  checkinWeekday: number;
}>;

/**
 * The schedule to set on `today`, or null when the program already has one (ADR 0002, Amendment 2,
 * "The start snapshot and the schedule", point 6). It is set whenever `next_checkin_date` is null, which
 * covers every program the wizard creates and a new program after an ended one. It does not depend on the
 * start snapshot, so a returning user who keeps the learned expenditure still gets a schedule.
 */
export function scheduleToSet(
  program: Readonly<{ next_checkin_date: string | null }>,
  today: string,
): ScheduleToSet | null {
  if (program.next_checkin_date !== null) {
    return null;
  }
  return { nextCheckinDate: firstCheckinDate(today), checkinWeekday: checkinWeekday(today) };
}
