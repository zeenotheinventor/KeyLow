import { addCalendarDays } from "../../../src/dates";

import type { StreakDay } from "../../../src/achievements/streaks";

export const LONDON = "Europe/London";

/**
 * A day completed on its own evening. The `+00:00` is London in winter, so use it for days outside
 * British Summer Time and write the offset out by hand inside it.
 */
export function completeDay(localDate: string, time = "21:00"): StreakDay {
  return {
    localDate,
    isComplete: true,
    completedAt: `${localDate}T${time}:00+00:00`,
    entryCount: 2,
  };
}

/** `length` winter days in a row from `from`, each completed that evening. */
export function completeRun(from: string, length: number): StreakDay[] {
  return Array.from({ length }, (_, offset) => completeDay(addCalendarDays(from, offset)));
}
