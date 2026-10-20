import { vars } from "nativewind";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CartesianChart, Line, Scatter } from "victory-native";

import {
  axisTicks,
  formatTick,
  labelledIndexes,
  latestIndex,
  valueDomain,
  weekLabel,
} from "../../../lib/chart/linePlot";
import { useTheme } from "../../../lib/theme";
import { Text } from "../Text";
import { gutterClassName, plotInsetXClassName, plotInsetYClassName, plotPadding } from "./layout";

import type { LineChartProps } from "./types";

const DEFAULT_HEIGHT = 160;
const MAX_WEEK_LABELS = 4;
// Axis values and week labels sit in boxes the size of the default type, so they stay at it however large the
// person has set their text, and a long value such as "102.5" never wraps.
const FIXED_TEXT_SCALE = 1;
const VALUE_KEYS: "value"[] = ["value"];
const LINE_WIDTH = 2.5;
const POINT_RADIUS = 2.5;
const EMPHASISED_RADIUS = 4;

/**
 * A trend over weeks: a line through the readings, three values on the axis, the unit above it and the
 * week starts under it, thinned so they never run together. A skipped week breaks the line and has no point,
 * and a reading with a skipped week either side is a dot. The latest reading (or the selected week) is a
 * larger point in the marker colour. The colours are the design's chart tokens. The line and points are
 * drawn on Skia by Victory; everything else is ordinary views and text, so the whole chart is one image,
 * named by the caller's summary, which is also written under it.
 */
export function LineChart({
  points,
  unit,
  label,
  summary,
  formatValue = formatTick,
  selectedWeek,
  onSelectWeek,
  height = DEFAULT_HEIGHT,
}: LineChartProps) {
  const { colors } = useTheme();

  const values = useMemo(() => points.map((point) => point.value), [points]);
  const domain = useMemo(() => valueDomain(values), [values]);
  const data = useMemo(() => values.map((value, index) => ({ index, value })), [values]);
  const ticks = domain === undefined ? [] : axisTicks(domain);
  const selectedIndex = points.findIndex((point) => point.week === selectedWeek);
  const emphasisedIndex = selectedIndex === -1 ? latestIndex(values) : selectedIndex;
  const labelled = labelledIndexes(points.length, MAX_WEEK_LABELS);

  return (
    <View
      accessible
      aria-label={summary}
      className="gap-2"
      role="img"
      style={vars({ "--chart-height": height })}
    >
      <View className="flex-row items-baseline gap-2">
        <Text tone="secondary" variant="caption">
          {label}
        </Text>
        <Text tone="muted" variant="caption">
          {unit}
        </Text>
      </View>
      <View>
        <View className="flex-row">
          <View
            aria-hidden
            className={`h-[var(--chart-height)] ${gutterClassName} items-end justify-between pr-2`}
          >
            {ticks.map((tick, position) => (
              <Text
                key={position}
                maxFontSizeMultiplier={FIXED_TEXT_SCALE}
                tone="muted"
                variant="caption"
              >
                {formatValue(tick)}
              </Text>
            ))}
          </View>
          <View className="h-[var(--chart-height)] flex-1">
            <View aria-hidden className="absolute inset-0">
              <View className={`flex-1 justify-between ${plotInsetYClassName}`}>
                <View className="h-px bg-chart-grid" />
                <View className="h-px bg-chart-grid" />
                <View className="h-px bg-chart-axis" />
              </View>
              {domain !== undefined && (
                <View className="absolute inset-0">
                  <CartesianChart
                    data={data}
                    domain={{ x: [-0.5, points.length - 0.5], y: [domain.min, domain.max] }}
                    padding={plotPadding}
                    xKey="index"
                    yKeys={VALUE_KEYS}
                  >
                    {({ points: plotted }) => (
                      <>
                        <Line
                          color={colors["chart-trend"]}
                          connectMissingData={false}
                          points={plotted.value}
                          strokeCap="round"
                          strokeJoin="round"
                          strokeWidth={LINE_WIDTH}
                        />
                        <Scatter
                          color={colors["chart-point"]}
                          points={plotted.value.filter((point) => point.xValue !== emphasisedIndex)}
                          radius={POINT_RADIUS}
                        />
                        <Scatter
                          color={colors["chart-marker"]}
                          points={plotted.value.filter((point) => point.xValue === emphasisedIndex)}
                          radius={EMPHASISED_RADIUS}
                        />
                      </>
                    )}
                  </CartesianChart>
                </View>
              )}
            </View>
            {onSelectWeek !== undefined && (
              <View className={`absolute inset-0 flex-row ${plotInsetXClassName}`}>
                {points.map((point) =>
                  point.value === null ? (
                    <View className="flex-1" key={point.week} />
                  ) : (
                    <Pressable
                      aria-label={weekLabel(point.week)}
                      className="flex-1"
                      key={point.week}
                      onPress={() => {
                        onSelectWeek(point.week);
                      }}
                      role="button"
                    />
                  ),
                )}
              </View>
            )}
          </View>
        </View>
        <View aria-hidden className="h-4 flex-row">
          <View className={gutterClassName} />
          <View className={`flex-1 flex-row ${plotInsetXClassName}`}>
            {points.map((point, index) => (
              <View className="flex-1 items-center" key={point.week}>
                {labelled.has(index) && (
                  <Text
                    className="absolute w-12 text-center"
                    maxFontSizeMultiplier={FIXED_TEXT_SCALE}
                    tone="muted"
                    variant="caption"
                  >
                    {weekLabel(point.week)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
      <Text tone="secondary" variant="caption">
        {summary}
      </Text>
    </View>
  );
}
