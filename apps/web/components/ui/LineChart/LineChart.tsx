import {
  VALUE_COLUMN_WIDTH,
  axisTicks,
  formatTick,
  gridLineYs,
  labelledIndexes,
  latestIndex,
  lineRuns,
  plotWeekColumns,
  runPath,
  valueDomain,
  weekBandPath,
  weekChartLayout,
  weekColumns,
  weekLabel,
  weekPlotArea,
} from "@keylow/core/chart";

import type { LineChartProps } from "./types";

import { useElementSize } from "@/lib/useElementSize";
import { vars } from "@/lib/vars";

const POINT_RADIUS = 2.5;
const MARKER_RADIUS = 4;
// The value on the axis sits level with its grid line: the top of an 11 on 14 label is half its line height above it.
const TICK_TOP_OFFSET = 7;

const TICK_CLASS_NAME = "text-[11px] leading-[14px] tabular-nums text-text-muted";
const FOCUS_CLASS_NAME =
  "absolute inset-y-0 left-[var(--column-left)] w-[var(--column-width)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

/**
 * A trend over weeks, drawn in SVG at the width its column gives it, as the web's weight chart is: a line
 * through the readings, three values on the right, the label and unit above and the week starts under it,
 * thinned so they never run together. Each week is an equal column with its point in the middle. A skipped
 * week breaks the line and has no point, and a reading with a skipped week either side is a point alone. The
 * latest reading, or the selected week, is a larger marker ringed in the surface colour. With a `band` the
 * likely range of each week is shaded behind the line, and a `legend` names the line and the band.
 *
 * Width decides the height and the number of week labels, nothing else. The chart is one image named by the
 * summary, which is also written under it. With `onSelectWeek` each week with a reading is a button over its
 * column, so a press and the keyboard both select it, and the drawing alone is then the image.
 */
export function LineChart({
  points,
  unit,
  label,
  summary,
  formatValue = formatTick,
  selectedWeek,
  onSelectWeek,
  band,
  legend,
}: LineChartProps) {
  const { reference, size } = useElementSize<HTMLDivElement>();
  const isInteractive = onSelectWeek !== undefined;

  const values = points.map((point) => point.value);
  const domain = valueDomain(values, band);
  const layout = size === null ? null : weekChartLayout(size.width);
  const area = size === null || layout === null ? null : weekPlotArea(size.width, layout.height);
  const placed = area === null ? [] : plotWeekColumns(values, area, domain);
  const selectedIndex = points.findIndex((point) => point.week === selectedWeek);
  const emphasisedIndex = selectedIndex === -1 ? latestIndex(values) : selectedIndex;
  const labelled = labelledIndexes(points.length, layout?.maxWeekLabels ?? 0);
  const columns = area === null ? [] : weekColumns(points.length, area);
  const [topY, middleY, bottomY] = area === null ? [] : gridLineYs(area);
  const gridEnd = size === null ? 0 : size.width - VALUE_COLUMN_WIDTH;
  const ticks = domain === undefined ? [] : axisTicks(domain);

  return (
    <figure
      aria-label={isInteractive ? undefined : summary}
      className="relative w-full rounded-large border border-border bg-surface pt-3"
      role={isInteractive ? undefined : "img"}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 px-3 pb-1">
        <span className="text-caption text-text-secondary">{label}</span>
        <span className="text-caption text-text-muted">{unit}</span>
      </div>
      <div className="relative min-h-[160px]" ref={reference}>
        {size === null || layout === null || area === null ? null : (
          <>
            <svg
              aria-hidden={isInteractive ? undefined : true}
              aria-label={isInteractive ? summary : undefined}
              className="block w-full"
              height={layout.height}
              role={isInteractive ? "img" : undefined}
              viewBox={`0 0 ${size.width} ${layout.height}`}
              width={size.width}
            >
              <path
                className="fill-none stroke-chart-grid"
                d={`M0 ${topY}H${gridEnd}M0 ${middleY}H${gridEnd}`}
              />
              <path className="fill-none stroke-chart-axis" d={`M0 ${bottomY}H${gridEnd}`} />
              {band === undefined ? null : (
                <path className="fill-chart-band" d={weekBandPath(values, band, area, domain)} />
              )}
              {lineRuns(placed).map((run) => (
                <path
                  className="fill-none stroke-chart-trend stroke-[2.5]"
                  d={runPath(run)}
                  key={run[0]?.index}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {placed.map((point) =>
                point === null || point.index === emphasisedIndex ? null : (
                  <circle
                    className="fill-chart-point"
                    cx={point.x}
                    cy={point.y}
                    key={point.index}
                    r={POINT_RADIUS}
                  />
                ),
              )}
              {placed.map((point) =>
                point === null || point.index !== emphasisedIndex ? null : (
                  <circle
                    className="fill-chart-marker stroke-surface stroke-2"
                    cx={point.x}
                    cy={point.y}
                    key={point.index}
                    r={MARKER_RADIUS}
                  />
                ),
              )}
            </svg>
            {ticks.map((tick, position) => (
              <span
                aria-hidden
                className={`absolute right-2 top-[var(--tick-top)] ${TICK_CLASS_NAME}`}
                key={position}
                style={vars({
                  "--tick-top": `${(gridLineYs(area)[position] ?? 0) - TICK_TOP_OFFSET}px`,
                })}
              >
                {formatValue(tick)}
              </span>
            ))}
            {onSelectWeek === undefined
              ? null
              : points.map((point, index) =>
                  point.value === null ? null : (
                    <button
                      aria-label={weekLabel(point.week)}
                      aria-pressed={
                        selectedWeek === undefined ? undefined : point.week === selectedWeek
                      }
                      className={FOCUS_CLASS_NAME}
                      key={point.week}
                      onClick={() => {
                        onSelectWeek(point.week);
                      }}
                      style={vars({
                        "--column-left": `${columns[index]?.left ?? 0}px`,
                        "--column-width": `${columns[index]?.width ?? 0}px`,
                      })}
                      type="button"
                    />
                  ),
                )}
          </>
        )}
      </div>
      {area === null ? null : (
        <div aria-hidden className="relative mt-1 h-[14px]">
          {points.map((point, index) =>
            labelled.has(index) ? (
              <span
                className={`absolute left-[var(--label-left)] top-0 -translate-x-1/2 whitespace-nowrap ${TICK_CLASS_NAME}`}
                key={point.week}
                style={vars({
                  "--label-left": `${(columns[index]?.left ?? 0) + (columns[index]?.width ?? 0) / 2}px`,
                })}
              >
                {weekLabel(point.week)}
              </span>
            ) : null,
          )}
        </div>
      )}
      {band !== undefined && legend !== undefined && (
        <div
          aria-hidden
          className="flex flex-wrap gap-x-4 gap-y-1 px-3 pt-2 text-caption text-text-secondary"
        >
          <span className="inline-flex items-center gap-[6px]">
            <span className="h-[2px] w-[14px] rounded-[1px] bg-chart-trend" />
            {legend.line}
          </span>
          <span className="inline-flex items-center gap-[6px]">
            <span className="h-[10px] w-[14px] rounded-[2px] border border-chart-axis bg-chart-band" />
            {legend.band}
          </span>
        </div>
      )}
      <figcaption
        aria-hidden={isInteractive ? true : undefined}
        className="px-3 pb-3 pt-2 text-caption text-text-secondary"
      >
        {summary}
      </figcaption>
    </figure>
  );
}
