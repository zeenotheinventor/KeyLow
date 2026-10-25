import { WEIGHT_SCREEN, describeChartDate } from "@keylow/core/copy";
import { addCalendarDays } from "@keylow/core/dates";
import { rangeWindow } from "@keylow/core/weight";

import { buildAxis } from "./buildAxis";

import type {
  BodyCompositionChartData,
  BodyCompositionChartPlot,
  BodyCompositionChartPoint,
  CompositionInputPoint,
} from "./types";
import type { WeightRange } from "@keylow/core/weight";

type PrepareBodyCompositionChartInput = {
  /** The composition trend over every day, as core made it. It is filtered here and never worked out again. */
  points: readonly CompositionInputPoint[];
  range: WeightRange;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
};

const MILLISECONDS_PER_DAY = 86_400_000;

// `YYYY-MM-DD` parses as midnight UTC, so two days are a whole number of days apart.
const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / MILLISECONDS_PER_DAY);

function buildPlot(points: readonly BodyCompositionChartPoint[]): BodyCompositionChartPlot {
  return {
    points: [...points],
    latest: points.at(-1) ?? null,
    yAxis: buildAxis(points.map((point) => point.value)),
  };
}

/**
 * What the figure draws for a range: the part of the composition trend inside it, placed by day, once for
 * body fat and once for lean mass. Pure, so it is tested without drawing. The trend is only filtered, and
 * each plot has an axis of its own.
 */
export function prepareBodyCompositionChart({
  points,
  range,
  today,
}: PrepareBodyCompositionChartInput): BodyCompositionChartData {
  const window = rangeWindow(range, today);
  // `YYYY-MM-DD` sorts as text in date order, so the dates compare without being parsed.
  const inRange = points.filter((point) => point.date >= window.from && point.date <= window.to);
  const placed = (point: CompositionInputPoint, value: number): BodyCompositionChartPoint => ({
    date: point.date,
    dayIndex: daysBetween(window.from, point.date),
    value,
    segment: point.segment,
  });

  return {
    range,
    window,
    bodyFat: buildPlot(inRange.map((point) => placed(point, point.fat))),
    leanMass: buildPlot(inRange.map((point) => placed(point, point.lean))),
    xLabels: [
      describeChartDate(window.from),
      describeChartDate(addCalendarDays(today, -Math.round((range - 1) / 2))),
      WEIGHT_SCREEN.chartToday,
    ],
  };
}
