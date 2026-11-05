import { addCalendarDays } from "../dates/calendarDay";

import type { BodyMapView } from "./bodyMapValues";
import type { WeekDayStatus } from "./weekPlanDays";

/*
 * Which day and which view the body map and the muscle list show, worked out once for every screen that
 * draws them. The day is picked on the scrubber or carried in a link's address, and the view is the one
 * remembered on the device. Neither is shown as it stands: the day must be one the view can choose, and the
 * view must be one the plan allows.
 */

/**
 * The day a pick or an address names, when it is a day of the week other than today, and otherwise nothing.
 * An address carries any text, so only a calendar day of this week is taken and anything else is never sent
 * to a read. Today is nothing too, since it is read as the current moment and follows the clock.
 */
export const heatDateOf = (
  candidate: unknown,
  today: string,
  weekStart: string,
): string | undefined => {
  if (typeof candidate !== "string" || candidate === today) {
    return undefined;
  }
  const weekDates = Array.from({ length: 7 }, (_, offset) => addCalendarDays(weekStart, offset));
  return weekDates.find((date) => date === candidate);
};

/**
 * The view shown: Projected when it was chosen and there is a routine for it to show, and Actual otherwise.
 * The choice is kept for when there is a routine.
 */
export const bodyMapViewOf = (
  chosenView: BodyMapView,
  projectedAvailable: boolean | undefined,
): BodyMapView =>
  chosenView === "projected" && projectedAvailable === true ? "projected" : "actual";

/**
 * The day Actual is read at. Actual stops at today, so a day after it is not asked for, unless the side by
 * side view shows Actual next to Projected on any day of the week. None is the current moment.
 */
export const actualReadDateOf = (
  heatDate: string | undefined,
  today: string,
  isSideBySide: boolean,
): string | undefined =>
  heatDate !== undefined && (isSideBySide || heatDate < today) ? heatDate : undefined;

/**
 * The day shown: the one picked when the days of the view shown can choose it, and otherwise today. The
 * figures, the line under the label, the scrubber, the muscle sheet and the muscle list all follow it.
 */
export const selectedDateOf = (
  heatDate: string | undefined,
  shownDays: readonly Readonly<{ date: string; selectable: boolean }>[],
  today: string,
): string =>
  heatDate !== undefined &&
  shownDays.some(({ date, selectable }) => date === heatDate && selectable)
    ? heatDate
    : today;

/** A day of the week as the planned sessions are read from it: `BodyMapDay` of api-client has these fields and more. */
export type PlannedSessionSource = Readonly<{
  /** The calendar day, `YYYY-MM-DD`. */
  date: string;
  status: WeekDayStatus;
  /** The name of the routine day planned for the date, or null when none is. */
  plannedDayName: string | null;
}>;

/**
 * The sessions a projection assumes: the planned days from the day after today up to the day shown (Zee's
 * ruling D), so on today it assumes none and shows what is logged.
 */
export const plannedSessionsOf = (
  days: readonly PlannedSessionSource[],
  today: string,
  selectedDate: string,
): { localDate: string; routineDayName: string | null }[] =>
  days
    .filter(({ date, status }) => status === "planned" && date > today && date <= selectedDate)
    .map(({ date, plannedDayName }) => ({ localDate: date, routineDayName: plannedDayName }));
