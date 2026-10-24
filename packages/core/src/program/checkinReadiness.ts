import { addCalendarDays, dayNumber, daysSinceMonday } from "../dates/calendarDay";
import { isCompleteDayWithIntake, isRealAcceptedWeighIn } from "../engine/measureExpenditure";
import { DEFAULT_ENGINE_PARAMS } from "../engine/params";

import type { DayInput, TrendPoint } from "../engine/types";

/** The days a check-in reads, first to last, as `YYYY-MM-DD`. */
export type CheckinWindow = Readonly<{ startDate: string; endDate: string }>;

export type FirstCheckinReadiness = Readonly<{
  /** Days in the window with a real, accepted weigh-in. */
  weighDays: number;
  /** Days from the first weigh-in in the window to the last, both counted. 0 with no weigh-in. */
  coverDays: number;
  /** Days in the window marked complete. */
  completeDays: number;
  /** What the check-in needs, read from the engine's params. */
  targets: Readonly<{ weighDays: number; coverDays: number; completeDays: number }>;
  /**
   * The earliest date a weigh-in would complete the cover, while the cover is not met and that date is today
   * or later and still inside the window. Null otherwise.
   */
  tipDate: string | null;
}>;

export type FirstCheckinReadinessInput = Readonly<{
  /** The check-in day, `YYYY-MM-DD`. It is never in the window. */
  asOfDate: string;
  /** The user's local date, `YYYY-MM-DD`. */
  today: string;
  /** The days with a real, accepted weigh-in, see `acceptedWeighInDates`. Any order. */
  weighInDates: readonly string[];
  /** The days marked complete. Any order. */
  completeDates: readonly string[];
}>;

/** The window the check-in on `asOfDate` measures: the days before it, the day itself excluded. */
export function checkinWindow(asOfDate: string): CheckinWindow {
  return {
    startDate: addCalendarDays(asOfDate, -DEFAULT_ENGINE_PARAMS.expenditure.windowDays),
    endDate: addCalendarDays(asOfDate, -1),
  };
}

/** The Monday-start weeks the window touches. */
export type CheckinWindowWeeks = Readonly<{
  /** Five Mondays in a row, the first being the Monday of the window's first day. */
  weekStarts: readonly [string, string, string, string, string];
  /** False when the window ends before the fifth Monday, so only the first four weeks are needed. */
  touchesFifthWeek: boolean;
}>;

const DAYS_PER_WEEK = 7;

/**
 * The Mondays of the weeks the window touches, for reading a week at a time. A 28 day window (four weeks of
 * `windowDays`) touches four weeks when it starts on a Monday and five otherwise, so five Mondays are always
 * given and `touchesFifthWeek` says whether the last is needed.
 */
export function checkinWindowWeeks(asOfDate: string): CheckinWindowWeeks {
  const { startDate, endDate } = checkinWindow(asOfDate);
  const firstMonday = addCalendarDays(startDate, -daysSinceMonday(startDate));
  const mondayAfter = (weeks: number) => addCalendarDays(firstMonday, weeks * DAYS_PER_WEEK);
  const fifthMonday = mondayAfter(4);

  return {
    weekStarts: [firstMonday, mondayAfter(1), mondayAfter(2), mondayAfter(3), fifthMonday],
    touchesFifthWeek: fifthMonday <= endDate,
  };
}

/** The dates of the days the measurement counts as complete: marked complete, with an intake. */
export function completeDayDates(days: readonly DayInput[]): string[] {
  return days.filter(isCompleteDayWithIntake).map((day) => day.localDate);
}

/** The dates of the trend's days that count as a weigh-in, by the rule `measureExpenditure` counts them with. */
export function acceptedWeighInDates(trend: readonly TrendPoint[]): string[] {
  return trend.filter(isRealAcceptedWeighIn).map((point) => point.date);
}

/**
 * What the first check-in needs and what the person has so far, counted over the check-in's own window, so that
 * readings from before setup count (ADR 0002, Amendment 2, "The measurement"). The targets are the engine's
 * eligibility rules, so a retune moves them. Pure: dates are text, never a clock.
 */
export function firstCheckinReadiness({
  asOfDate,
  today,
  weighInDates,
  completeDates,
}: FirstCheckinReadinessInput): FirstCheckinReadiness {
  const { minSpanDays, minWeighDays, minCompleteDays } = DEFAULT_ENGINE_PARAMS.expenditure;
  const { startDate, endDate } = checkinWindow(asOfDate);
  const inWindow = (date: string) => date >= startDate && date <= endDate;

  const weighDates = [...new Set(weighInDates.filter(inWindow))].sort();
  const firstWeighIn = weighDates[0];
  const lastWeighIn = weighDates.at(-1);
  const coverDays =
    firstWeighIn === undefined || lastWeighIn === undefined
      ? 0
      : dayNumber(lastWeighIn) - dayNumber(firstWeighIn) + 1;

  const neededDate =
    firstWeighIn === undefined || coverDays >= minSpanDays
      ? null
      : addCalendarDays(firstWeighIn, minSpanDays - 1);

  return {
    weighDays: weighDates.length,
    coverDays,
    completeDays: new Set(completeDates.filter(inWindow)).size,
    targets: { weighDays: minWeighDays, coverDays: minSpanDays, completeDays: minCompleteDays },
    tipDate:
      neededDate !== null && neededDate >= today && neededDate <= endDate ? neededDate : null,
  };
}
