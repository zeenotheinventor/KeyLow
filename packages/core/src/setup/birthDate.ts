import { ageInYears, isCalendarDay } from "../dates";

/** An age under this is not accepted (Zee's ruling 4). */
export const MIN_AGE_YEARS = 13;

/** An age over this is refused as a typing mistake. */
export const MAX_AGE_YEARS = 100;

export type BirthDateReason = "not-a-date" | "future" | "too-young" | "too-old";

export type BirthDateResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: BirthDateReason }>;

const refuse = (reason: BirthDateReason): BirthDateResult => ({ ok: false, reason });

/**
 * Whether this birth date can be used on `today`, both `YYYY-MM-DD`. A reason is a code, because a
 * birth date is health data and must not reach a log. 13 years on the day is accepted, and 12 years
 * and 364 days is too young.
 */
export function checkBirthDate(birthDate: string, today: string): BirthDateResult {
  if (!isCalendarDay(birthDate)) {
    return refuse("not-a-date");
  }
  if (birthDate > today) {
    return refuse("future");
  }

  const age = ageInYears(birthDate, today);
  if (age < MIN_AGE_YEARS) {
    return refuse("too-young");
  }
  if (age > MAX_AGE_YEARS) {
    return refuse("too-old");
  }
  return { ok: true };
}
