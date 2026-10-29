import { completeDayLog, dayTotalsRow, diaryBackend } from "./diaryBackend";

// The week of the boards, Monday 12 to Sunday 18 October 2026, today Thursday the 15th.
const BOARD_DAYS = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];

type DayKcal = number | null;

/**
 * Puts a week in the fake database: each day's kcal (null for a day with nothing logged), with protein,
 * carbs and fat made up from it, and the days marked complete. A day past Thursday is a day to come.
 */
export function showWeek(kcalByDay: DayKcal[], completeDays: string[] = []): void {
  diaryBackend.dayTotals = kcalByDay.flatMap((kcal, index) => {
    const day = BOARD_DAYS[index];

    return day === undefined || kcal === null
      ? []
      : [dayTotalsRow(day, [kcal, kcal / 20, kcal / 10, kcal / 30])];
  });
  diaryBackend.dayLogs = completeDays.map((day) => completeDayLog(day));
}

/**
 * The sample week: 2,140, 2,260, 1,286 and 1,039 kcal, Monday and Tuesday complete. Its average is 1,681 up
 * to today and 1,895 up to yesterday.
 */
export function showSampleWeek(): void {
  showWeek([2140, 2260, 1286, 1039], ["2026-10-12", "2026-10-13"]);
}

/** The over-target week: Wednesday is 2,988 and today 2,412, so the average is 2,450 up to today and 2,463 up to yesterday. */
export function showOverTargetWeek(): void {
  showWeek([2140, 2260, 2988, 2412], ["2026-10-12", "2026-10-13"]);
}

/** The week with nothing logged on any day. */
export function showEmptyWeek(): void {
  showWeek([]);
}
