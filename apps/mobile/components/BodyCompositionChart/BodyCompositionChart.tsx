import { BODY_COMPOSITION } from "@keylow/core/copy";
import { DashPathEffect } from "@shopify/react-native-skia";
import { vars } from "nativewind";
import { useMemo } from "react";
import { Text as NativeText, View } from "react-native";
import { CartesianChart, Line, Scatter } from "victory-native";

import { emptyGridOffsets, plotOffsetOf, plotPadding } from "./layout";
import { useTheme } from "../../lib/theme";

import type { BodyCompositionChartPlot, BodyCompositionChartProps } from "./types";
import type { WeightRange } from "@keylow/core/weight";
import type { PointsArray } from "victory-native";

// The board draws the trend 2.25 wide, where the ticket says 2.5.
const TREND_WIDTH = 2.25;
const MARKER_RADIUS = 4.5;
const MARKER_RING_WIDTH = 2;
// The board dashes the trend 5 on and 4 off while it settles.
const SETTLING_DASH = [5, 4];
const PLOT_SERIES = ["line", "latest"] as const;
// The y values, the captions and the x labels sit in boxes the size of the board's 11 point text, so they stay
// at it however large the person has set their text.
const FIXED_TEXT_SCALE = 1;
const LABEL_CLASS_NAME = "text-[11px] font-normal leading-[14px] tabular-nums";
const MUTED_LABEL_CLASS_NAME = `${LABEL_CLASS_NAME} text-text-muted`;
const CAPTION_CLASS_NAME =
  "absolute left-3 top-0 h-[14px] text-[11px] font-normal leading-[14px] text-text-secondary";
// Each plot's box, whole, so Tailwind sees the classes. The second starts after the first and the gap.
const FIRST_PLOT_CLASS_NAME = "absolute inset-x-0 top-3 h-[76px]";
const SECOND_PLOT_CLASS_NAME = "absolute inset-x-0 top-[96px] h-[76px]";

const hasValue = (points: PointsArray): PointsArray => points.filter((point) => point.y != null);

type PlotProps = {
  caption: string;
  className: string;
  isSettling: boolean;
  plot: BodyCompositionChartPlot;
  range: WeightRange;
};

/** One plot: its grid, y values and caption as views, and its line and marker drawn by Victory on Skia. */
function Plot({ caption, className, isSettling, plot, range }: PlotProps) {
  const { colors } = useTheme();
  const rows = useMemo(
    () =>
      plot.points.map((point) => ({
        day: point.dayIndex,
        line: point.value,
        latest: point.dayIndex === plot.latest?.dayIndex ? point.value : null,
      })),
    [plot],
  );
  const segmentOfDay = useMemo(
    () =>
      new Map<string | number, number>(plot.points.map((point) => [point.dayIndex, point.segment])),
    [plot.points],
  );
  const { yAxis } = plot;
  const ticks =
    yAxis === null
      ? emptyGridOffsets.map((offset) => ({ offset, label: "" }))
      : yAxis.ticks.map((tick) => ({ offset: plotOffsetOf(tick, yAxis), label: String(tick) }));

  return (
    <>
      <View aria-hidden className={className}>
        {ticks.map((tick) => (
          <View
            className="absolute inset-x-0 top-[var(--tick-offset)]"
            key={tick.offset}
            style={vars({ "--tick-offset": tick.offset })}
          >
            <View className="absolute left-0 right-10 h-px bg-chart-grid" />
            {tick.label === "" ? null : (
              <NativeText
                className={`absolute -top-[7px] right-2 ${MUTED_LABEL_CLASS_NAME}`}
                maxFontSizeMultiplier={FIXED_TEXT_SCALE}
              >
                {tick.label}
              </NativeText>
            )}
          </View>
        ))}
        <NativeText className={CAPTION_CLASS_NAME} maxFontSizeMultiplier={FIXED_TEXT_SCALE}>
          {caption}
        </NativeText>
      </View>
      {yAxis === null ? null : (
        <View aria-hidden className={className}>
          <CartesianChart
            data={rows}
            domain={{ x: [0, range - 1], y: [yAxis.min, yAxis.max] }}
            padding={plotPadding}
            xKey="day"
            yKeys={[...PLOT_SERIES]}
          >
            {({ points }) => {
              const runs: PointsArray[] = [];
              for (const point of hasValue(points.line)) {
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
    </>
  );
}

/**
 * The figure of the composition view: body fat over lean mass as two stacked plots that share the x axis,
 * each with its own y axis, grid, caption, trend line (dashed while it settles) and marker on its latest
 * value. The first day, the middle day and today sit once under the second plot. The grid and the labels are
 * views, so they can be read in a test. The whole figure is one image named by the caller, and its parts are
 * hidden from a screen reader. A range with no point draws both grids and the days, and no line.
 */
export function BodyCompositionChart({ data, isSettling, name }: BodyCompositionChartProps) {
  return (
    <View
      accessible
      aria-label={name}
      className="h-[196px] overflow-hidden rounded-large border border-border bg-surface"
      role="img"
    >
      <Plot
        caption={BODY_COMPOSITION.kinds.body_fat_pct.label}
        className={FIRST_PLOT_CLASS_NAME}
        isSettling={isSettling}
        plot={data.bodyFat}
        range={data.range}
      />
      <Plot
        caption={BODY_COMPOSITION.kinds.lean_mass_kg.label}
        className={SECOND_PLOT_CLASS_NAME}
        isSettling={isSettling}
        plot={data.leanMass}
        range={data.range}
      />
      <View
        aria-hidden
        className="absolute inset-x-0 top-[172px] flex-row justify-between pl-3 pr-[44px] pt-1"
      >
        {data.xLabels.map((label, position) => (
          <NativeText
            className={MUTED_LABEL_CLASS_NAME}
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
