import { streakNudgeNotification } from "../../copy/remindersScreen";
import { instantAtLocalTime, toLocalDate } from "../../dates";

import type { DailyStreak } from "./types";

/** The hour of the evening nudge, which the Reminders screen's helper line says as "8pm". */
export const STREAK_NUDGE_HOUR = 20;

export type StreakNudge = Readonly<{ fireAt: Date; title: string; body: string }>;

/**
 * The nudge for today, or null when there is nothing to send: today already counts (`today` is the daily
 * streak's own answer), 20:00 local time has passed, or there is no streak to keep. Only today is planned,
 * because a later day cannot be known to be incomplete, and a nudge must never fire on a completed day.
 * Pure: the zone is required and the clock is an argument.
 */
export function planStreakNudge({
  now,
  timeZone,
  today,
  currentStreak,
}: {
  now: Date;
  timeZone: string;
  today: DailyStreak["today"];
  /** `DailyStreak.current`: the days in a row up to yesterday when today is not complete. */
  currentStreak: number;
}): StreakNudge | null {
  if (today === "complete" || currentStreak < 1) {
    return null;
  }
  const fireAt = instantAtLocalTime(toLocalDate(now, timeZone), STREAK_NUDGE_HOUR, 0, timeZone);
  if (fireAt.getTime() <= now.getTime()) {
    return null;
  }
  return { fireAt, ...streakNudgeNotification(currentStreak) };
}
