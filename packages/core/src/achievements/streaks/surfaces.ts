import { weekCounts } from "./walkWeeklyStreak";
import {
  addCalendarDays,
  addMonths,
  daysSinceMonday,
  monthOf,
  monthWeeks,
  previousCalendarDay,
} from "../../dates";

import type { CalendarDayState, CalendarRange, DailyStreak, WeekRecord, WeekState } from "./types";

const DAYS_PER_WEEK = 7;

/**
 * The days the streak calendar sheet and the chip read: the whole month `today` is in, and yesterday
 * too, so on the 1st the chip can still see that yesterday was frozen.
 */
export const streakCalendarRangeOf = (today: string): CalendarRange => {
  const firstOfMonth = `${monthOf(today)}-01`;
  const yesterday = previousCalendarDay(today);

  return {
    from: yesterday < firstOfMonth ? yesterday : firstOfMonth,
    to: addCalendarDays(addMonths(firstOfMonth, 1), -1),
  };
};

/** What the Dashboard chip says: no streak, a streak kept, a streak at risk, or one a freeze just kept. */
export type StreakChipState = "none" | "active" | "at_risk" | "freeze_used";

/**
 * The chip's state from the daily streak. Today not being complete is what the person can act on, so it
 * wins over a freeze used for yesterday, which shows once today is complete. `today` is the local date
 * and `daily.calendar` must include yesterday.
 */
export const streakChipStateOf = (daily: DailyStreak, today: string): StreakChipState => {
  if (daily.current === 0) {
    return "none";
  }
  if (daily.today === "at_risk") {
    return "at_risk";
  }
  const yesterday = previousCalendarDay(today);
  return daily.calendar.some((day) => day.localDate === yesterday && day.state === "frozen")
    ? "freeze_used"
    : "active";
};

/** One cell of the month: a day as the calendar describes it, or null before the 1st and after the last. */
export type StreakMonthCell = CalendarDayState | null;

/** The month of `today` as weeks, Monday first, each cell with the calendar's state for its day. */
export const streakMonthOf = (
  calendar: readonly CalendarDayState[],
  today: string,
): StreakMonthCell[][] => {
  const byDate = new Map(calendar.map((day) => [day.localDate, day]));

  return monthWeeks(monthOf(today)).map((week) =>
    week.map((localDate) =>
      localDate === null
        ? null
        : (byDate.get(localDate) ?? { localDate, state: "future" as const }),
    ),
  );
};

export type WeekBar = { weekStart: string; state: WeekState };

export type RecentWeeks = {
  /** The last weeks, oldest first, the last one being this week. */
  bars: WeekBar[];
  /** What this week has so far, against what it asks for. A week with no record asks for 1. */
  achieved: number;
  required: number;
};

/** The last `count` Monday to Sunday weeks of a weekly streak, for the bars on the Train and Weight screens. */
export const recentWeeksOf = (
  records: readonly WeekRecord[],
  today: string,
  count: number,
): RecentWeeks => {
  const thisWeekStart = addCalendarDays(today, -daysSinceMonday(today));
  const byWeek = new Map(records.map((record) => [record.weekStart, record]));

  const bars = Array.from({ length: count }, (_, index): WeekBar => {
    const weekStart = addCalendarDays(thisWeekStart, (index - (count - 1)) * DAYS_PER_WEEK);
    if (weekStart === thisWeekStart) {
      return { weekStart, state: weekCounts(byWeek.get(weekStart)) ? "complete" : "at_risk" };
    }
    return { weekStart, state: weekCounts(byWeek.get(weekStart)) ? "complete" : "missed" };
  });
  const current = byWeek.get(thisWeekStart);

  return { bars, achieved: current?.achieved ?? 0, required: current?.required ?? 1 };
};
