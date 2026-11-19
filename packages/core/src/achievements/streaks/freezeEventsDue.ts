import { freezeRowKey } from "./freezeRowKey";
import { walkDailyStreak } from "./walkDailyStreak";
import { walkWeeklyStreak } from "./walkWeeklyStreak";
import { addCalendarDays } from "../../dates";

import type { FreezeGrant, FreezeRow, StreakDay, WeekRecord } from "./types";

export const TRAINING_STREAK_REASON = "training_streak";
export const WEIGH_IN_STREAK_REASON = "weigh_in_streak";
const WEIGH_IN_WEEKS_PER_FREEZE = 4;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

// The first week of a training streak starts it, and every week after that continues it.
const trainingWeekEarns = (streakLength: number): boolean => streakLength >= 2;
const weighInWeekEarns = (streakLength: number): boolean =>
  streakLength % WEIGH_IN_WEEKS_PER_FREEZE === 0;

export type FreezeEventsInput = {
  days: StreakDay[];
  /** Every row already written. */
  ledger: FreezeRow[];
  /** Freezes earned outside the streak maths: levels, Gold and Platinum, Perfect Weeks, first uses. */
  grants: FreezeGrant[];
  /** The training streak's weeks, each with its planned count as `required`. */
  trainingWeeks: WeekRecord[];
  /** The weigh-in streak's weeks, each with `required` 1. */
  weighInWeeks: WeekRecord[];
  today: string;
  now: Date;
  zone: string;
};

/**
 * The ledger rows still to write: freezes earned (every 7 days in a row, every week the training streak
 * continues, every 4 weeks the weigh-in streak continues, plus the grants it is given)
 * and freezes used (one for each missed day, in date order, only from freezes earned on or before that
 * day). Rows already in the ledger, by kind, reason and reference, are left out, so writing the result twice
 * is harmless. Pure: `today`, `now` and the zone are arguments and the clock is never read.
 */
export function freezeEventsDue(input: FreezeEventsInput): FreezeRow[] {
  const { days, ledger, grants, trainingWeeks, weighInWeeks, today, now, zone } = input;
  const grantRows: FreezeRow[] = grants.map((grant) => ({ kind: "earned", ...grant }));
  const weeklyRows = [
    ...weeklyFreezeRows(trainingWeeks, today, TRAINING_STREAK_REASON, trainingWeekEarns),
    ...weeklyFreezeRows(weighInWeeks, today, WEIGH_IN_STREAK_REASON, weighInWeekEarns),
  ];
  const earnedRows = [
    ...ledger.filter((row) => row.kind === "earned"),
    ...grantRows,
    ...weeklyRows,
  ];
  const walk = walkDailyStreak({ days, earnedRows, today, now, zone });

  const writtenKeys = new Set(ledger.map(freezeRowKey));
  const seenKeys = new Set<string>();

  return [...grantRows, ...weeklyRows, ...walk.streakEarnedRows, ...walk.usedRows]
    .filter((row) => {
      const key = freezeRowKey(row);
      const isNew = !writtenKeys.has(key) && !seenKeys.has(key);
      seenKeys.add(key);
      return isNew;
    })
    .sort(compareRows);
}

/** Date order, with a freeze earned on a day before one used on it. */
function compareRows(left: FreezeRow, right: FreezeRow): number {
  if (left.date !== right.date) {
    return left.date < right.date ? -1 : 1;
  }
  return left.kind === right.kind ? 0 : left.kind === "earned" ? -1 : 1;
}

/** A freeze for each week that has ended and earns one, dated on its Sunday and keyed by its Monday. */
function weeklyFreezeRows(
  weeks: WeekRecord[],
  today: string,
  reason: string,
  earnsFreeze: (streakLength: number) => boolean,
): FreezeRow[] {
  return walkWeeklyStreak(weeks, today)
    .endedRuns.filter((run) => earnsFreeze(run.length))
    .map((run) => ({
      kind: "earned",
      reason,
      reference: run.weekStart,
      date: addCalendarDays(run.weekStart, DAYS_FROM_MONDAY_TO_SUNDAY),
      count: 1,
    }));
}
