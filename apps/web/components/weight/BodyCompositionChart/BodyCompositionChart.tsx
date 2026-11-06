import { BODY_COMPOSITION } from "@keylow/core/copy";
import { useMemo } from "react";

import { emptyGridYs, gridEndOf, labelTopOf, xOfDay, yOfValue } from "./layout";

import type { BodyCompositionChartProps } from "./types";
import type { ElementSize } from "@/lib/useElementSize";
import type { BodyCompositionChartPlot, BodyCompositionChartPoint } from "@keylow/core/weight";
import type { ReactNode } from "react";

import { useElementSize } from "@/lib/useElementSize";
import { vars } from "@/lib/vars";

// The sizes are the board's, in pixels.
const MARKER_RADIUS = 4.5;

const LABEL_CLASS_NAME = "text-[11px] leading-[14px] text-text-muted";

type PlotName = "first" | "second";

/** The line as runs of days that are joined, because the line does not join two runs of readings. */
function runsOf(points: readonly BodyCompositionChartPoint[]): BodyCompositionChartPoint[][] {
  const runs: BodyCompositionChartPoint[][] = [];
  for (const point of points) {
    const run = runs.at(-1);
    if (run?.at(-1)?.segment === point.segment) {
      run.push(point);
    } else {
      runs.push([point]);
    }
  }

  return runs;
}

/** One grid line: how far from the top of the drawing it is, and the value it stands for, which a plot with no point does not name. */
type GridLine = { y: number; value: number | null };

type DrawnPlot = { grid: GridLine[]; marks: ReactNode };

function drawPlot(
  plot: BodyCompositionChartPlot,
  name: PlotName,
  range: number,
  isSettling: boolean,
  size: ElementSize,
): DrawnPlot {
  const { yAxis, latest } = plot;
  if (yAxis === null) {
    return { grid: emptyGridYs(name, size).map((y) => ({ y, value: null })), marks: null };
  }
  const x = (point: BodyCompositionChartPoint) => xOfDay(point.dayIndex, range, size);
  const y = (value: number) => yOfValue(value, yAxis, name, size);

  return {
    grid: yAxis.ticks.map((tick) => ({ y: y(tick), value: tick })),
    marks: (
      <>
        {runsOf(plot.points).map((run) =>
          // A run of one day has no line to draw. Its day carries the marker.
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
                  return `${command}${x(point).toFixed(1)} ${y(point.value).toFixed(1)}`;
                })
                .join("")}
              key={run[0]?.dayIndex}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
        )}
        {latest === null ? null : (
          <circle
            className="fill-chart-marker stroke-surface stroke-2"
            cx={x(latest)}
            cy={y(latest.value)}
            r={MARKER_RADIUS}
          />
        )}
      </>
    ),
  };
}

const NO_GRID: GridLine[] = [];

type PlotLabelsProps = { caption: string; captionClassName: string; grid: readonly GridLine[] };

/** A plot's caption at its top left and its y values at the right, as text over the drawing. */
function PlotLabels({ caption, captionClassName, grid }: PlotLabelsProps) {
  return (
    <>
      <span
        aria-hidden
        className={`absolute left-3 h-[14px] text-[11px] leading-[14px] text-text-secondary ${captionClassName}`}
      >
        {caption}
      </span>
      {grid.map(({ y, value }) =>
        value === null ? null : (
          <span
            aria-hidden
            className={`absolute right-2 top-[var(--label-top)] tabular-nums ${LABEL_CLASS_NAME}`}
            key={value}
            style={vars({ "--label-top": `${labelTopOf(y)}px` })}
          >
            {value}
          </span>
        ),
      )}
    </>
  );
}

/**
 * The figure of the Composition view, drawn as the `web-weight, body-composition-view-kg` board draws it:
 * body fat over lean mass as two stacked plots that share the x axis, each with its own y axis, grid, caption,
 * trend line (dashed while it settles) and marker on its latest value. The first day, the middle day and
 * today sit once under the second plot. It is the weight chart's box, 12 of padding, the drawing and the 30
 * high labels, so the switch between the two does not move the page. It is drawn in SVG at the size its
 * column gives it, read as the column changes, so a marker stays the same size at every width. The whole
 * figure is one image named by the caller, and its parts are hidden from a screen reader. A range with no
 * point draws both grids and the days, and no line.
 */
export function BodyCompositionChart({ data, isSettling, name }: BodyCompositionChartProps) {
  const { reference, size } = useElementSize<SVGSVGElement>();
  const plots = useMemo(
    () =>
      size === null
        ? null
        : ([
            drawPlot(data.bodyFat, "first", data.range, isSettling, size),
            drawPlot(data.leanMass, "second", data.range, isSettling, size),
          ] as const),
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
        {size === null || plots === null
          ? null
          : plots.map(({ grid, marks }, position) => (
              <g key={position}>
                {grid.map(({ y }) => (
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
              </g>
            ))}
      </svg>
      <PlotLabels
        caption={BODY_COMPOSITION.kinds.body_fat_pct.label}
        captionClassName="top-3"
        grid={plots?.[0].grid ?? NO_GRID}
      />
      <PlotLabels
        caption={BODY_COMPOSITION.kinds.lean_mass_kg.label}
        captionClassName="top-[96px] lg:top-[126px]"
        grid={plots?.[1].grid ?? NO_GRID}
      />
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
