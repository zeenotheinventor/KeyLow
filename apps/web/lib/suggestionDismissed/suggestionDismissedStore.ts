import { isCalendarDay } from "@keylow/core/dates";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

export const SUGGESTION_DISMISSED_KEY = "train.suggestionDismissed";

const KEPT_DAYS = 14;

// The days are kept as one text, written YYYY-MM-DD and joined by commas. Anything else is not ours.
const isStoredDays = (stored: string): stored is string => stored.split(",").every(isCalendarDay);

/**
 * The days (`YYYY-MM-DD`) whose suggestion the person put off with Not now in this browser. A date is all
 * that is kept, and it is not health data. A store that cannot be read, or holds anything else, is none
 * put off. Call it from an effect or an event handler, not from a render the server also runs.
 */
export function readDismissedDays(): readonly string[] {
  return readLocalPreference(SUGGESTION_DISMISSED_KEY, isStoredDays)?.split(",") ?? [];
}

/** The days with `day` put off as well: once, and only the newest fourteen, so the list does not grow for ever. */
export function withDayDismissed(days: readonly string[], day: string): readonly string[] {
  return days.includes(day) ? days : [...days, day].slice(-KEPT_DAYS);
}

/** A day that cannot be stored shows the card again on the next visit, so the failure is not raised. */
export function writeDismissedDays(days: readonly string[]): void {
  writeLocalPreference(SUGGESTION_DISMISSED_KEY, days.join(","));
}
