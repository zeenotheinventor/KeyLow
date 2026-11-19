import { hasBackOnTrack } from "./hasBackOnTrack";
import { walkDailyStreak } from "./walkDailyStreak";
import { walkWeekends } from "./walkWeekends";
import { addCalendarDays, previousCalendarDay } from "../../dates";

import type {
  CalendarDayState,
  CalendarRange,
  DailyStreak,
  DayState,
  FreezeRow,
  StreakDay,
} from "./types";

/**
 * The daily streak, built from Day complete. `today` is the local date, `now` is the instant, and the
 * zone is the user's: nothing here reads the clock. A day that is missed is settled at 12:00 the next day, so
 * today is at risk until local midnight and yesterday stays completable until 12:00 today. Pass the
 * whole history, oldest day first or not, because the streak is walked from the first counted day.
 */
export function dailyStreak(
  days: StreakDay[],
  freezeLedger: FreezeRow[],
  today: string,
  now: Date,
  zone: string,
  calendarRange?: CalendarRange,
): DailyStreak {
  const earnedRows = freezeLedger.filter((row) => row.kind === "earned");
  const walk = walkDailyStreak({ days, earnedRows, today, now, zone });
  const yesterday = previousCalendarDay(today);

  return {
    current: walk.current,
    longest: walk.longest,
    today: walk.today,
    yesterdayCompletable: walk.states.get(yesterday) === "at_risk",
    calendar: calendarRange === undefined ? [] : describeRange(calendarRange, today, walk.states),
    freezesHeld: walk.freezesEarned - walk.usedRows.length,
    freezesUsed: walk.usedRows.length,
    backOnTrack: hasBackOnTrack(walk.countedDates, walk.isSettled),
    weekendRun: walkWeekends(walk.countedDates, today, walk.isSettled),
  };
}

function describeRange(
  range: CalendarRange,
  today: string,
  states: Map<string, DayState>,
): CalendarDayState[] {
  const calendar: CalendarDayState[] = [];

  for (
    let localDate = range.from;
    localDate <= range.to;
    localDate = addCalendarDays(localDate, 1)
  ) {
    calendar.push({ localDate, state: stateOf(localDate, today, states) });
  }
  return calendar;
}

function stateOf(localDate: string, today: string, states: Map<string, DayState>): DayState {
  if (localDate > today) {
    return "future";
  }
  return states.get(localDate) ?? "missed";
}
