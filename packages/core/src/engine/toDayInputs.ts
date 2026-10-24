import type { DayInput } from "./types";

/** One `day_totals` row as the check-in reads it. */
export type DayTotalRow = Readonly<{
  /** The day in the user's time zone, written `YYYY-MM-DD`. */
  local_date: string;
  /** The day's total kilocalories, or null when nothing is logged. */
  kcal: number | null;
}>;

/** One `day_logs` row as the check-in reads it. */
export type DayLogRow = Readonly<{
  /** The day in the user's time zone, written `YYYY-MM-DD`. */
  local_date: string;
  is_complete: boolean;
}>;

/**
 * Joins the `day_totals` and `day_logs` rows on their date into the engine's `DayInput`s, in date order.
 * A day with a total and no `day_logs` row is not complete (ADR 0002, Amendment 2, "The measurement"). A
 * day with a log row and no total has a null intake. With two rows for one date the later one wins.
 */
export function toDayInputs(
  dayTotals: readonly DayTotalRow[],
  dayLogs: readonly DayLogRow[],
): DayInput[] {
  const kcalByDate = new Map(dayTotals.map((row) => [row.local_date, row.kcal]));
  const isCompleteByDate = new Map(dayLogs.map((row) => [row.local_date, row.is_complete]));
  const dates = [...new Set([...kcalByDate.keys(), ...isCompleteByDate.keys()])].sort();

  return dates.map((localDate) => ({
    localDate,
    intakeKcal: kcalByDate.get(localDate) ?? null,
    isComplete: isCompleteByDate.get(localDate) ?? false,
  }));
}
