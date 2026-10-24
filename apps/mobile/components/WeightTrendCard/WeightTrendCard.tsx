import {
  WEIGHT_RANGE_LABELS,
  WEIGHT_SCREEN,
  describeChartName,
  describeRateBadge,
  describeSettlingLine,
  describeTrendLine,
} from "@keylow/core/copy";
import { WEIGHT_RANGES } from "@keylow/core/weight";
import { useMemo, useState } from "react";
import { Text as NativeText, View } from "react-native";

import { Badge, Card, SegmentedControl, Text } from "../ui";
import { WeightChart, prepareWeightChart } from "../WeightChart";

import type { WeightTrendCardProps } from "./types";
import type { WeightRange } from "@keylow/core/weight";

const DEFAULT_RANGE: WeightRange = 90;

const rangeOptions = WEIGHT_RANGES.map((range) => ({
  value: String(range),
  label: WEIGHT_RANGE_LABELS[range],
}));

const oneDecimal = (kilograms: number): string => (Math.round(kilograms * 10) / 10).toFixed(1);

/**
 * The Trend weight card of the Weight screen, with the range control and the chart under it. The card
 * says where the trend stands: the weekly rate, or "Settling" while the trend has too few readings, the
 * trend to one decimal and a line about the last weigh-in. The range is held here, starts on 90 days and is
 * not kept, unless the screen gives one (`range` with `onRangeChange`) so that one control also drives the
 * Body composition cards. A range only chooses which days are drawn, because the trend is worked out once from every
 * weigh-in and never again for a range. The screen reads the weigh-ins and works the trend out, and gives
 * both to the card: a card that read them itself would be a second reader of the whole history, and would
 * read it again as it appeared.
 */
export function WeightTrendCard({
  weighIns,
  trend,
  today,
  range: givenRange,
  onRangeChange,
}: WeightTrendCardProps) {
  const [ownRange, setOwnRange] = useState<WeightRange>(DEFAULT_RANGE);
  const range = givenRange ?? ownRange;

  const chart = useMemo(
    () => prepareWeightChart({ points: trend.points, weighIns, range, today }),
    [trend.points, weighIns, range, today],
  );

  const latestPoint = trend.points.at(-1);
  if (latestPoint === undefined) {
    return null;
  }

  return (
    <View className="gap-3">
      <Card aria-label={WEIGHT_SCREEN.trendCardName}>
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="uppercase tracking-[0.04em]" tone="secondary" variant="caption">
              {WEIGHT_SCREEN.trendCardName}
            </Text>
            {trend.settling ? (
              <Badge tone="warning">{WEIGHT_SCREEN.settlingBadge}</Badge>
            ) : trend.weeklyRateKg === null ? null : (
              <Badge tone="accent">{describeRateBadge(trend.weeklyRateKg)}</Badge>
            )}
          </View>
          <View className="flex-row items-baseline gap-1">
            {/* The design sets the trend at 40 over 46, which is between the type scale's sizes, as the calorie ring's numeral is. */}
            <NativeText className="text-[40px] font-semibold leading-[46px] tracking-[-0.02em] tabular-nums text-text-primary">
              {oneDecimal(latestPoint.trendKg)}
            </NativeText>
            <Text tone="secondary">{WEIGHT_SCREEN.unit}</Text>
          </View>
          {/* The design draws the line in the label size at the regular weight, which no Text variant has. */}
          <NativeText className="text-[14px] font-normal leading-[20px] tabular-nums text-text-secondary">
            {trend.settling
              ? describeSettlingLine(latestPoint.nObs)
              : describeTrendLine({
                  lastKg: latestPoint.rawKg ?? latestPoint.trendKg,
                  lastLocalDate: latestPoint.date,
                  today,
                  weeklyRateKg: trend.weeklyRateKg,
                })}
          </NativeText>
        </View>
      </Card>
      <SegmentedControl
        label={WEIGHT_SCREEN.rangeGroupLabel}
        options={rangeOptions}
        value={String(range)}
        onChange={(next) => {
          const picked = WEIGHT_RANGES.find((option) => String(option) === next) ?? DEFAULT_RANGE;
          setOwnRange(picked);
          onRangeChange?.(picked);
        }}
      />
      <WeightChart
        data={chart}
        isSettling={trend.settling}
        name={describeChartName(range, latestPoint.trendKg)}
      />
      <View className="flex-row gap-4 px-1">
        <View className="flex-row items-center gap-[6px]">
          <View aria-hidden className="h-[2px] w-[14px] rounded-[1px] bg-chart-trend" />
          <Text tone="secondary" variant="caption">
            {WEIGHT_SCREEN.legend.trend}
          </Text>
        </View>
        <View className="flex-row items-center gap-[6px]">
          <View aria-hidden className="h-[6px] w-[6px] rounded-pill bg-chart-point" />
          <Text tone="secondary" variant="caption">
            {WEIGHT_SCREEN.legend.weighIn}
          </Text>
        </View>
        <View className="flex-row items-center gap-[6px]">
          <View
            aria-hidden
            className="h-[6px] w-[6px] rounded-pill border-[1.5px] border-warning"
          />
          <Text tone="secondary" variant="caption">
            {WEIGHT_SCREEN.legend.leftOut}
          </Text>
        </View>
      </View>
    </View>
  );
}
