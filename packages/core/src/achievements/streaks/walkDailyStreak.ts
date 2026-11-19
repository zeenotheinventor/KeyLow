import { countsForStreak } from "./countsForStreak";
import { isBeforeDayCompleteCutoff } from "./dayCompleteCutoff";
import { freezeRowKey } from "./freezeRowKey";
import { addCalendarDays, previousCalendarDay } from "../../dates";

import type { DayState, FreezeRow, StreakDay } from "./types";

export const DAILY_STREAK_REASON = "daily_streak";
export const MISSED_DAY_REASON = "missed_day";
const DAYS_PER_DAILY_FREEZE = 7;

export type DailyWalkInput = {
  days: StreakDay[];
  /** Every freeze earned somewhere other than the daily streak, written or not. A repeated key counts once, the first row winning. */
  earnedRows: FreezeRow[];
  today: string;
  now: Date;
  zone: string;
};

export type DailyWalk = {
  current: number;
  longest: number;
  today: "complete" | "at_risk";
  /** What each walked day is, from the first counted day to today. Days before that are not in it. */
  states: Map<string, DayState>;
  /** Freezes the daily streak itself earned, one for every 7 days in a row, once the seventh day is settled. */
  streakEarnedRows: FreezeRow[];
  /** One freeze for each settled missed day the streak kept alive, in date order. */
  usedRows: FreezeRow[];
  /** All the freezes earned, written or not. */
  freezesEarned: number;
  /** The days that count, oldest first, up to today. */
  countedDates: string[];
  /** Whether a day is settled: past 12:00 on the next local day, so it can no longer change. */
  isSettled: (localDate: string) => boolean;
};

/**
 * Walks the diary from the first counted day to today and settles each day in date order. Pure: `today`,
 * `now` and the zone are arguments and the clock is never read.
 */
export function walkDailyStreak(input: DailyWalkInput): DailyWalk {
  const { days, today, now, zone } = input;
  const earnedRows = firstOfEachKey(input.earnedRows);
  const countedSet = new Set(
    days
      .filter((day) => day.localDate <= today && countsForStreak(day, zone))
      .map((day) => day.localDate),
  );
  const counts = (localDate: string): boolean => countedSet.has(localDate);
  const isSettled = (localDate: string): boolean =>
    !isBeforeDayCompleteCutoff(now.getTime(), localDate, zone);

  const countedDates = [...countedSet].sort();
  const states = new Map<string, DayState>();
  const knownEarnedKeys = new Set(earnedRows.map(freezeRowKey));
  const streakEarnedRows: FreezeRow[] = [];
  const usedRows: FreezeRow[] = [];
  const allEarnedRows = [...earnedRows];
  let current = 0;
  let longest = 0;
  // A day that is not complete yet but can still be completed. It is settled as missed only if the
  // streak has to carry on past it, because a later day that counts shows what it turned out to be.
  let openDate: string | undefined;

  // A freeze covers a missed day when the streak is alive and one was earned on or before that day.
  const settleMissedDay = (localDate: string, keepRecord: boolean): DayState => {
    const earnedByThen = sumOf(allEarnedRows.filter((row) => row.date <= localDate));
    const used = usedRows.length;
    if (current > 0 && earnedByThen > used) {
      if (keepRecord) {
        usedRows.push({
          kind: "used",
          reason: MISSED_DAY_REASON,
          reference: localDate,
          date: localDate,
          count: 1,
        });
      }
      return "frozen";
    }
    current = 0;
    return "missed";
  };

  for (
    let localDate = earlierOf(countedDates[0] ?? today, previousCalendarDay(today));
    localDate <= today;
    localDate = addCalendarDays(localDate, 1)
  ) {
    if (counts(localDate)) {
      if (openDate !== undefined) {
        settleMissedDay(openDate, false);
        openDate = undefined;
      }
      current += 1;
      longest = Math.max(longest, current);
      states.set(localDate, "complete");
      if (current % DAYS_PER_DAILY_FREEZE === 0 && isSettled(localDate)) {
        const row: FreezeRow = {
          kind: "earned",
          reason: DAILY_STREAK_REASON,
          reference: localDate,
          date: localDate,
          count: 1,
        };
        if (!knownEarnedKeys.has(freezeRowKey(row))) {
          streakEarnedRows.push(row);
          allEarnedRows.push(row);
        }
      }
    } else if (isSettled(localDate)) {
      states.set(localDate, settleMissedDay(localDate, true));
    } else {
      states.set(localDate, "at_risk");
      openDate = localDate === today ? undefined : localDate;
    }
  }

  return {
    current,
    longest,
    today: counts(today) ? "complete" : "at_risk",
    states,
    streakEarnedRows,
    usedRows,
    freezesEarned: sumOf(allEarnedRows),
    countedDates,
    isSettled,
  };
}

/** The earlier of two `YYYY-MM-DD` days. The walk starts no later than yesterday, which can still be open. */
function earlierOf(left: string, right: string): string {
  return left < right ? left : right;
}

function sumOf(rows: FreezeRow[]): number {
  return rows.reduce((total, row) => total + row.count, 0);
}

function firstOfEachKey(rows: FreezeRow[]): FreezeRow[] {
  const seenKeys = new Set<string>();

  return rows.filter((row) => {
    const key = freezeRowKey(row);
    const isFirst = !seenKeys.has(key);
    seenKeys.add(key);
    return isFirst;
  });
}
