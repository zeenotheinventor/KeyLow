import { streakCalendarRangeOf } from "@keylow/core";
import { addCalendarDays } from "@keylow/core/dates";

import type { CalendarDayState, DayState } from "@keylow/core";

/** Thursday 19 November 2026, the day the streaks board is drawn on. */
export const BOARD_TODAY = "2026-11-19";

const boardStates: Readonly<Record<string, DayState>> = {
  "2026-11-07": "missed",
  "2026-11-14": "frozen",
};

/**
 * November 2026 as board 4 draws it: every day to the 18th complete bar the 7th (missed) and the 14th
 * (kept by a freeze), today at risk, and the rest still to come. Over core's own range for the month.
 */
export const boardCalendar: CalendarDayState[] = (() => {
  const { from, to } = streakCalendarRangeOf(BOARD_TODAY);
  const days: CalendarDayState[] = [];
  for (let localDate = from; localDate <= to; localDate = addCalendarDays(localDate, 1)) {
    const state: DayState =
      localDate === BOARD_TODAY
        ? "at_risk"
        : localDate > BOARD_TODAY
          ? "future"
          : (boardStates[localDate] ?? "complete");
    days.push({ localDate, state });
  }
  return days;
})();
