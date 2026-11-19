import { isBeforeDayCompleteCutoff } from "../achievements/streaks";

export type DayCompleteState =
  /** Nothing is logged, so there is nothing to complete. */
  | "noEntries"
  /** Today, with an entry, not complete. */
  | "ready"
  /** Yesterday, with an entry, not complete, before 12:00 today. */
  | "yesterdayOpen"
  /** An older day, or yesterday after 12:00, with an entry, not complete. */
  | "outsideWindow"
  /** Complete, and it is today. */
  | "completedToday"
  /** Complete, on another day. */
  | "complete"
  /** Complete, while the phone has no connection. */
  | "savedOffline";

export type DayCompleteViewInput = {
  /** The viewed day, `YYYY-MM-DD`. */
  localDate: string;
  /** The local date now. */
  today: string;
  now: Date;
  timeZone: string;
  entryCount: number;
  isComplete: boolean;
  isOnline: boolean;
};

export type DayCompleteView = {
  state: DayCompleteState;
  /** Today, or yesterday before 12:00 today: completing the day can still count for the streak. */
  isInStreakWindow: boolean;
};

/**
 * Which state the Diary's Day complete control is in for the viewed day, and whether completing that day can
 * still count for the streak. The window is the same one `countsForStreak` enforces: until 12:00 on the
 * next local day. Pure: the clock and the zone are passed in.
 */
export function dayCompleteView(input: DayCompleteViewInput): DayCompleteView {
  const { localDate, today, now, timeZone } = input;
  const isInStreakWindow =
    localDate >= today || isBeforeDayCompleteCutoff(now.getTime(), localDate, timeZone);

  return { state: stateOf(input, isInStreakWindow), isInStreakWindow };
}

function stateOf(input: DayCompleteViewInput, isInStreakWindow: boolean): DayCompleteState {
  if (input.isComplete) {
    if (!input.isOnline) {
      return "savedOffline";
    }
    return input.localDate === input.today ? "completedToday" : "complete";
  }
  if (input.entryCount < 1) {
    return "noEntries";
  }
  if (input.localDate >= input.today) {
    return "ready";
  }
  return isInStreakWindow ? "yesterdayOpen" : "outsideWindow";
}

export type StreakLine = {
  streakDays: number;
  /** Today is still to be completed, so the line says to complete it to keep the streak. */
  isAtRisk: boolean;
  /** Only today's line has the flame. */
  hasFlame: boolean;
};

/**
 * The streak line of the Diary header for the viewed day, or null for none: the days outside the streak
 * window and a streak that is not known yet or is not running have no line. `streakDays` is the current
 * daily streak from `dailyStreak`.
 */
export function streakLineOf(
  view: DayCompleteView,
  localDate: string,
  today: string,
  streakDays: number | null,
): StreakLine | null {
  if (!view.isInStreakWindow || localDate > today || streakDays === null || streakDays < 1) {
    return null;
  }
  return { streakDays, isAtRisk: view.state === "ready", hasFlame: localDate === today };
}
