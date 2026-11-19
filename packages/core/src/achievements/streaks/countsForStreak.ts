import { isBeforeDayCompleteCutoff } from "./dayCompleteCutoff";

import type { StreakDay } from "./types";

/**
 * Whether a diary day counts for the daily streak: it is complete, has at least one entry, and was
 * completed before 12:00 on the next local day in the user's zone. The Day complete toggle lets any
 * date be completed or undone at any time, so this window is enforced here. Pure.
 */
export function countsForStreak(day: StreakDay, timeZone: string): boolean {
  if (!day.isComplete || day.entryCount < 1 || day.completedAt === null) {
    return false;
  }
  return isBeforeDayCompleteCutoff(Date.parse(day.completedAt), day.localDate, timeZone);
}
