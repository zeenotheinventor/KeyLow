import { DashPathEffect } from "@shopify/react-native-skia";
import { vars } from "nativewind";
import { useMemo } from "react";
import { Text as NativeText, View } from "react-native";
import { CartesianChart, Line, Scatter } from "victory-native";

import { WEIGHT_CHART_SERIES, buildChartRows } from "./chartRows";
import { emptyGridOffsets, plotOffsetOf, plotPadding } from "./layout";
import { useTheme } from "../../lib/theme";

import type { WeightChartProps } from "./types";
import type { PointsArray } from "victory-native";

// The board draws the trend 2.25 wide, where the ticket says 2.5.
const TREND_WIDTH = 2.25;
const READING_RADIUS = 2.6;
const READING_RADIUS_YEAR = 1.6;
const FILLED_RADIUS = 2.2;
const FILLED_WIDTH = 1.25;
const LEFT_OUT_RADIUS = 3.5;
const LEFT_OUT_WIDTH = 1.75;
const MARKER_RADIUS = 4.5;
const MARKER_RING_WIDTH = 2;
// The board dashes the trend 5 on and 4 off while it settles, and outlines a filled day with a 2 on, 2 off ring.
const SETTLING_DASH = [5, 4];
const FILLED_DASH = [2, 2];
// A year of readings is too many for the larger dot, and a year does not mark filled days, as the board has it.
const YEAR_RANGE = 365;
// The y values and the x labels sit in boxes the size of the board's 11 point text, so they stay at it however
// large the person has set their text.
const FIXED_TEXT_SCALE = 1;
const LABEL_CLASS_NAME = "text-[11px] font-normal leading-[14px] tabular-nums text-text-muted";

const hasValue = (points: PointsArray): PointsArray => points.filter((point) => point.y != null);

/**
 * The figure of the trend card: grid, y values on the right, the readings as dots, the days the trend left
 * out as rings, the trend as a line (dashed while it settles), a marker on the latest trend value and the
 * first day, the middle day and today under it. Victory draws the data on Skia. The grid and the labels are
 * views, so they can be read in a test. The whole figure is one image named by the caller, and its parts are
 * hidden from a screen reader. A range with no point draws the grid and the days, and no data.
 */
export function WeightChart({ data, isSettling, name }: WeightChartProps) {
  const { colors } = useTheme();
  const rows = useMemo(() => buildChartRows(data), [data]);
  const segmentOfDay = useMemo(
    () =>
      new Map<string | number, number>(data.trend.map((point) => [point.dayIndex, point.segment])),
    [data.trend],
  );
  const { yAxis } = data;
  const ticks =
    yAxis === null
      ? emptyGridOffsets.map((offset) => ({ offset, label: "" }))
      : yAxis.ticks.map((tick) => ({ offset: plotOffsetOf(tick, yAxis), label: String(tick) }));

  return (
    <View
      accessible
      aria-label={name}
      className="h-[196px] overflow-hidden rounded-large border border-border bg-surface"
      role="img"
    >
      <View aria-hidden className="absolute inset-x-0 top-3 h-[160px]">
        {ticks.map((tick) => (
          <View
            className="absolute inset-x-0 top-[var(--tick-offset)]"
            key={tick.offset}
            style={vars({ "--tick-offset": tick.offset })}
          >
            <View className="absolute left-0 right-10 h-px bg-chart-grid" />
            {tick.label === "" ? null : (
              <NativeText
                className={`absolute -top-[7px] right-2 ${LABEL_CLASS_NAME}`}
                maxFontSizeMultiplier={FIXED_TEXT_SCALE}
              >
                {tick.label}
              </NativeText>
            )}
          </View>
        ))}
      </View>
      {yAxis === null ? null : (
        <View aria-hidden className="absolute inset-x-0 top-3 h-[160px]">
          <CartesianChart
            data={rows}
            domain={{ x: [0, data.range - 1], y: [yAxis.min, yAxis.max] }}
            padding={plotPadding}
            xKey="day"
            yKeys={[...WEIGHT_CHART_SERIES]}
          >
            {({ points }) => {
              const runs: PointsArray[] = [];
              for (const point of hasValue(points.trend)) {
                const run = runs.at(-1);
                const previous = run?.at(-1);
                if (
                  run !== undefined &&
                  previous !== undefined &&
                  segmentOfDay.get(previous.xValue) === segmentOfDay.get(point.xValue)
                ) {
                  run.push(point);
                } else {
                  runs.push([point]);
                }
              }

              return (
                <>
                  <Scatter
                    color={colors["chart-point"]}
                    points={points.reading}
                    radius={data.range === YEAR_RANGE ? READING_RADIUS_YEAR : READING_RADIUS}
                  />
                  {data.range === YEAR_RANGE ? null : (
                    <Scatter
                      color={colors["chart-point"]}
                      points={points.filled}
                      radius={FILLED_RADIUS}
                      strokeWidth={FILLED_WIDTH}
                      style="stroke"
                    >
                      <DashPathEffect intervals={FILLED_DASH} />
                    </Scatter>
                  )}
                  <Scatter
                    color={colors.warning}
                    points={points.leftOut}
                    radius={LEFT_OUT_RADIUS}
                    strokeWidth={LEFT_OUT_WIDTH}
                    style="stroke"
                  />
                  {runs.map((run) => (
                    <Line
                      color={colors["chart-trend"]}
                      key={run[0]?.xValue}
                      points={run}
                      strokeCap="round"
                      strokeJoin="round"
                      strokeWidth={TREND_WIDTH}
                    >
                      {isSettling ? <DashPathEffect intervals={SETTLING_DASH} /> : null}
                    </Line>
                  ))}
                  <Scatter
                    color={colors["chart-marker"]}
                    points={points.latest}
                    radius={MARKER_RADIUS}
                  />
                  <Scatter
                    color={colors.surface}
                    points={points.latest}
                    radius={MARKER_RADIUS}
                    strokeWidth={MARKER_RING_WIDTH}
                    style="stroke"
                  />
                </>
              );
            }}
          </CartesianChart>
        </View>
      )}
      <View
        aria-hidden
        className="absolute inset-x-0 top-[172px] flex-row justify-between pl-3 pr-[44px] pt-1"
      >
        {data.xLabels.map((label, position) => (
          <NativeText
            className={LABEL_CLASS_NAME}
            key={position}
            maxFontSizeMultiplier={FIXED_TEXT_SCALE}
          >
            {label}
          </NativeText>
        ))}
      </View>
    </View>
  );
}
