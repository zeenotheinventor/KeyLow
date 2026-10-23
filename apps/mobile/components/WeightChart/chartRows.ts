import type { WeightChartData } from "./types";

/** One row of the drawing. Each series has its own key, and a row holds a value for one or two of them. */
export type WeightChartRow = {
  /** Days after the first day of the range. */
  day: number;
  trend: number | null;
  filled: number | null;
  latest: number | null;
  reading: number | null;
  leftOut: number | null;
};

export const WEIGHT_CHART_SERIES = ["trend", "filled", "latest", "reading", "leftOut"] as const;

const emptyRow = (day: number): WeightChartRow => ({
  day,
  trend: null,
  filled: null,
  latest: null,
  reading: null,
  leftOut: null,
});

/**
 * The rows Victory draws from, in day order. A day has one row for the trend, and a row for each reading and
 * each left out reading, because a day can have two readings and Victory takes one value of a key for a row.
 */
export function buildChartRows(data: WeightChartData): WeightChartRow[] {
  const filledDays = new Set(data.filledDays.map((point) => point.dayIndex));

  return [
    ...data.trend.map((point) => ({
      ...emptyRow(point.dayIndex),
      trend: point.trendKg,
      filled: filledDays.has(point.dayIndex) ? point.trendKg : null,
      latest: point.dayIndex === data.latest?.dayIndex ? point.trendKg : null,
    })),
    ...data.readings.map((reading) => ({
      ...emptyRow(reading.dayIndex),
      reading: reading.weightKg,
    })),
    ...data.leftOut.map((reading) => ({
      ...emptyRow(reading.dayIndex),
      leftOut: reading.weightKg,
    })),
  ].sort((first, second) => first.day - second.day);
}
