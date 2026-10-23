import { isCalendarDay, parseCalendarDay } from "./calendarDay";

const FEBRUARY = 2;
const LAST_DAY_OF_FEBRUARY_IN_A_COMMON_YEAR = 28;
const LEAP_DAY = 29;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

function requireCalendarDay(calendarDate: string): void {
  if (!isCalendarDay(calendarDate)) {
    // A birth date is health data, so the message never holds it.
    throw new RangeError("Not a calendar date");
  }
}

/**
 * Whole years completed on `onDate` by someone born on `birthDate`, both `YYYY-MM-DD`. A 29 February
 * birthday counts on 28 February in a year with no 29 February. Negative when `onDate` is before the
 * birth date. Throws a `RangeError` that does not quote the date when either is not a calendar day.
 */
export function ageInYears(birthDate: string, onDate: string): number {
  requireCalendarDay(birthDate);
  requireCalendarDay(onDate);

  const birth = parseCalendarDay(birthDate);
  const on = parseCalendarDay(onDate);
  const birthdayDay =
    birth.month === FEBRUARY && birth.day === LEAP_DAY && !isLeapYear(on.year)
      ? LAST_DAY_OF_FEBRUARY_IN_A_COMMON_YEAR
      : birth.day;
  const hasHadBirthdayThisYear =
    on.month > birth.month || (on.month === birth.month && on.day >= birthdayDay);

  return on.year - birth.year - (hasHadBirthdayThisYear ? 0 : 1);
}
