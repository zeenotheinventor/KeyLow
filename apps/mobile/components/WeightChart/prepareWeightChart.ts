import { WEIGHT_SCREEN, describeChartDate } from "@keylow/core/copy";
import { addCalendarDays } from "@keylow/core/dates";
import { pointsInRange, rangeWindow, weighInsInRange } from "@keylow/core/weight";

import type {
  WeightChartAxis,
  WeightChartData,
  WeightChartReading,
  WeightChartTrendPoint,
} from "./types";
import type { TrendPoint } from "@keylow/core/engine";
import type { WeightRange } from "@keylow/core/weight";

type PrepareWeightChartInput = {
  /** The trend over every day, as `computeTrend` made it. It is filtered here and never worked out again. */
  points: readonly TrendPoint[];
  /** Every weigh-in. Only the day and the weight are read. */
  weighIns: readonly { local_date: string; weight_kg: number }[];
  range: WeightRange;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
};

const MILLISECONDS_PER_DAY = 86_400_000;
// The board labels one kilogram apart, and two when the span is wider than this.
const WIDE_SPAN_KG = 6;
// The margin the board leaves above the highest and below the lowest value before rounding out.
const AXIS_MARGIN_KG = 0.5;

// `YYYY-MM-DD` parses as midnight UTC, so two days are a whole number of days apart.
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / MILLISECONDS_PER_DAY);

/** The y axis in whole kilograms around every value drawn, the left out ones included, or null with none. */
function buildAxis(values: readonly number[]): WeightChartAxis | null {
  if (values.length === 0) {
    return null;
  }
  const min = Math.floor(Math.min(...values) - AXIS_MARGIN_KG);
  const max = Math.ceil(Math.max(...values) + AXIS_MARGIN_KG);
  const step = max - min > WIDE_SPAN_KG ? 2 : 1;
  const ticks: number[] = [];
  for (let tick = min; tick <= max; tick += step) {
    ticks.push(tick);
  }

  return { min, max, ticks };
}

/**
 * What the chart draws for a range: the part of the trend and of the weigh-ins inside it, placed by day.
 * Pure, so it is tested without drawing. The trend is only filtered, because the points before the window
 * decide the ones inside it. A day the trend left out is a ring and no dot, and is not on the line's
 * filled days, though it is filled too. A day with two readings has two dots.
 */
export function prepareWeightChart({
  points,
  weighIns,
  range,
  today,
}: PrepareWeightChartInput): WeightChartData {
  const window = rangeWindow(range, today);
  const placed = (date: string) => ({ date, dayIndex: daysBetween(window.from, date) });

  const trendInRange = pointsInRange(points, range, today);
  const leftOutDates = new Set(
    trendInRange.filter((point) => point.rejected).map((point) => point.date),
  );

  const trend: WeightChartTrendPoint[] = trendInRange.map((point) => ({
    ...placed(point.date),
    trendKg: point.trendKg,
    segment: point.segment,
  }));
  const filledDays = trendInRange
    .filter((point) => point.interpolated && !point.rejected)
    .map((point) => ({ ...placed(point.date), trendKg: point.trendKg, segment: point.segment }));
  const readings: WeightChartReading[] = weighInsInRange(weighIns, range, today)
    .filter((weighIn) => !leftOutDates.has(weighIn.local_date))
    .map((weighIn) => ({ ...placed(weighIn.local_date), weightKg: weighIn.weight_kg }));
  const leftOut: WeightChartReading[] = trendInRange.flatMap((point) =>
    point.rejected && point.rawKg !== null
      ? [{ ...placed(point.date), weightKg: point.rawKg }]
      : [],
  );

  return {
    range,
    window,
    readings,
    leftOut,
    trend,
    filledDays,
    latest: trend.at(-1) ?? null,
    yAxis: buildAxis([
      ...readings.map((reading) => reading.weightKg),
      ...leftOut.map((reading) => reading.weightKg),
      ...trend.map((point) => point.trendKg),
    ]),
    xLabels: [
      describeChartDate(window.from),
      describeChartDate(addCalendarDays(today, -Math.round((range - 1) / 2))),
      WEIGHT_SCREEN.chartToday,
    ],
  };
}
