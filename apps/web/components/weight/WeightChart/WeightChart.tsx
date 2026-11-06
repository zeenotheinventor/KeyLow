import { useMemo } from "react";

import { emptyGridYs, gridEndOf, labelTopOf, xOfDay, yOfWeight } from "./layout";

import type { ChartSize, WeightChartProps } from "./types";
import type { WeightChartData, WeightChartTrendPoint } from "@keylow/core/weight";
import type { ReactNode } from "react";

import { useElementSize } from "@/lib/useElementSize";
import { vars } from "@/lib/vars";

// The sizes are the board's, in pixels. A year of readings is too many for the larger dot, and a year does
// not mark filled days, as the board has it.
const READING_RADIUS = 2.6;
const READING_RADIUS_YEAR = 1.6;
const FILLED_RADIUS = 2.2;
const LEFT_OUT_RADIUS = 3.5;
const MARKER_RADIUS = 4.5;
const YEAR_RANGE = 365;

const LABEL_CLASS_NAME = "text-[11px] leading-[14px] text-text-muted";

/** The trend as runs of days that are joined, because the line does not join two runs of readings. */
function runsOf(trend: readonly WeightChartTrendPoint[]): WeightChartTrendPoint[][] {
  const runs: WeightChartTrendPoint[][] = [];
  for (const point of trend) {
    const run = runs.at(-1);
    if (run?.at(-1)?.segment === point.segment) {
      run.push(point);
    } else {
      runs.push([point]);
    }
  }

  return runs;
}

/** One grid line: how far from the top of the drawing it is, and the weight it stands for, which a range with no point does not name. */
type GridLine = { y: number; weightKg: number | null };

/** The grid, the dots, the line and the marker, placed for the box the column gives the drawing. */
function drawMarks(
  data: WeightChartData,
  isSettling: boolean,
  size: ChartSize,
): { grid: GridLine[]; marks: ReactNode } {
  const { yAxis, range } = data;
  if (yAxis === null) {
    return { grid: emptyGridYs(size).map((y) => ({ y, weightKg: null })), marks: null };
  }
  const x = (dayIndex: number) => xOfDay(dayIndex, range, size);
  const y = (weightKg: number) => yOfWeight(weightKg, yAxis, size);
  const isYear = range === YEAR_RANGE;

  return {
    grid: yAxis.ticks.map((tick) => ({ y: y(tick), weightKg: tick })),
    marks: (
      <>
        {data.readings.map((reading, position) => (
          <circle
            className="fill-chart-point"
            cx={x(reading.dayIndex)}
            cy={y(reading.weightKg)}
            // A day can have two readings, so the day alone is not a key.
            key={position}
            r={isYear ? READING_RADIUS_YEAR : READING_RADIUS}
          />
        ))}
        {isYear
          ? null
          : data.filledDays.map((point) => (
              <circle
                className="fill-none stroke-chart-point stroke-[1.25] [stroke-dasharray:2_2]"
                cx={x(point.dayIndex)}
                cy={y(point.trendKg)}
                key={point.dayIndex}
                r={FILLED_RADIUS}
              />
            ))}
        {data.leftOut.map((reading) => (
          <circle
            className="fill-none stroke-warning stroke-[1.75]"
            cx={x(reading.dayIndex)}
            cy={y(reading.weightKg)}
            key={reading.dayIndex}
            r={LEFT_OUT_RADIUS}
          />
        ))}
        {runsOf(data.trend).map((run) =>
          // A run of one day has no line to draw. Its day carries the reading and the marker.
          run.length < 2 ? null : (
            <path
              className={
                isSettling
                  ? "fill-none stroke-chart-trend stroke-[2.25] [stroke-dasharray:5_4]"
                  : "fill-none stroke-chart-trend stroke-[2.25]"
              }
              d={run
                .map((point, position) => {
                  const command = position === 0 ? "M" : "L";
                  return `${command}${x(point.dayIndex).toFixed(1)} ${y(point.trendKg).toFixed(1)}`;
                })
                .join("")}
              key={run[0]?.dayIndex}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
        {data.latest === null ? null : (
          <circle
            className="fill-chart-marker stroke-surface stroke-2"
            cx={x(data.latest.dayIndex)}
            cy={y(data.latest.trendKg)}
            r={MARKER_RADIUS}
          />
        )}
      </>
    ),
  };
}

/**
 * The figure of the trend card, drawn as the `web-weight, page-chart` board draws it: a grid, the y values at
 * its right, the readings as dots, the days the trend left out as rings, the trend as a line (dashed while it
 * settles), a marker on the latest trend value, and the first day, the middle day and today under it. It is
 * drawn in SVG at the size its column gives it, read as the column changes, so the dots stay the same size
 * at every width and are not scaled. The whole figure is one image named by the caller, and its parts are
 * hidden from a screen reader. A range with no point draws the grid and the days, and no marks.
 */
export function WeightChart({ data, isSettling, name }: WeightChartProps) {
  const { reference, size } = useElementSize<SVGSVGElement>();
  const { grid, marks } = useMemo(
    () => (size === null ? { grid: [], marks: null } : drawMarks(data, isSettling, size)),
    [data, isSettling, size],
  );

  return (
    <figure
      aria-label={name}
      className="relative rounded-large border border-border bg-surface pt-3"
      role="img"
    >
      <svg
        aria-hidden
        className="block h-[160px] w-full lg:h-[220px]"
        ref={reference}
        viewBox={size === null ? undefined : `0 0 ${size.width} ${size.height}`}
      >
        {size === null
          ? null
          : grid.map(({ y }) => (
              <line
                className="stroke-chart-grid"
                key={y}
                x1={0}
                x2={gridEndOf(size)}
                y1={y}
                y2={y}
              />
            ))}
        {marks}
      </svg>
      {grid.map(({ y, weightKg }) =>
        weightKg === null ? null : (
          <span
            aria-hidden
            className={`absolute right-2 top-[var(--label-top)] tabular-nums ${LABEL_CLASS_NAME}`}
            key={weightKg}
            style={vars({ "--label-top": `${labelTopOf(y)}px` })}
          >
            {weightKg}
          </span>
        ),
      )}
      <div
        aria-hidden
        className={`flex justify-between pb-3 pl-3 pr-[44px] pt-1 ${LABEL_CLASS_NAME}`}
      >
        {data.xLabels.map((label, position) => (
          <span key={position}>{label}</span>
        ))}
      </div>
    </figure>
  );
}
