import {
  WEIGHT_RANGE_LABELS,
  WEIGHT_SCREEN,
  describeChartName,
  describeRateBadge,
  describeSettlingLine,
  describeTrendLine,
} from "@keylow/core/copy";
import { WEIGHT_RANGES, prepareWeightChart } from "@keylow/core/weight";
import { useMemo } from "react";

import { WeightChart } from "../WeightChart";

import type { WeightTrendCardProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const rangeOptions = WEIGHT_RANGES.map((range) => ({
  value: String(range),
  label: WEIGHT_RANGE_LABELS[range],
}));

const oneDecimal = (kilograms: number): string => (Math.round(kilograms * 10) / 10).toFixed(1);

/**
 * The Trend weight card of the Weight page, with the range control and the chart under it, as the
 * `web-weight, page-chart` board draws them. The card says where the trend stands: the weekly rate, or
 * "Settling" while the trend has too few readings, the trend to one decimal and a line about the last
 * weigh-in. The range is held by the page, which gives it to the Body composition cards too. A range only chooses which days are
 * drawn, because the trend is worked out once from every weigh-in and never again for a range. The page reads
 * the weigh-ins and works the trend out, and gives both to the card: a card that read them itself would be a
 * second reader of the whole history. The prepared chart is kept for the inputs it was made from, so a
 * re-render with the same weigh-ins, range and day does not place a year of points again.
 */
export function WeightTrendCard({
  weighIns,
  trend,
  today,
  range,
  onRangeChange,
}: WeightTrendCardProps) {
  const chart = useMemo(
    () => prepareWeightChart({ points: trend.points, weighIns, range, today }),
    [trend.points, weighIns, range, today],
  );

  const latestPoint = trend.points.at(-1);
  if (latestPoint === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <Card asChild className="flex flex-col gap-1">
        <section aria-label={WEIGHT_SCREEN.trendCardName}>
          <div className="flex items-center justify-between">
            <span className="text-caption uppercase tracking-[0.04em] text-text-secondary">
              {WEIGHT_SCREEN.trendCardName}
            </span>
            {trend.settling ? (
              <Badge tone="warning">{WEIGHT_SCREEN.settlingBadge}</Badge>
            ) : trend.weeklyRateKg === null ? null : (
              <Badge tone="accent">{describeRateBadge(trend.weeklyRateKg)}</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-1 tabular-nums">
            {/* The board sets the trend at 40 over 46, which is between the type scale's sizes. */}
            <span className="text-[40px] font-semibold leading-[46px] tracking-[-0.02em]">
              {oneDecimal(latestPoint.trendKg)}
            </span>
            <span className="text-body text-text-secondary">{WEIGHT_SCREEN.unit}</span>
          </div>
          {/* The board draws the line in the label size at the regular weight, which no type class has. */}
          <span className="text-[14px] font-normal leading-5 tabular-nums text-text-secondary">
            {trend.settling
              ? describeSettlingLine(latestPoint.nObs)
              : describeTrendLine({
                  lastKg: latestPoint.rawKg ?? latestPoint.trendKg,
                  lastLocalDate: latestPoint.date,
                  today,
                  weeklyRateKg: trend.weeklyRateKg,
                })}
          </span>
        </section>
      </Card>
      <SegmentedControl
        label={WEIGHT_SCREEN.rangeGroupLabel}
        options={rangeOptions}
        value={String(range)}
        onChange={(next) => {
          onRangeChange(WEIGHT_RANGES.find((option) => String(option) === next) ?? range);
        }}
      />
      <WeightChart
        data={chart}
        isSettling={trend.settling}
        name={describeChartName(range, latestPoint.trendKg)}
      />
      <div className="flex gap-4 px-1">
        <span className="flex items-center gap-[6px] text-caption text-text-secondary">
          <span aria-hidden className="h-[2px] w-[14px] rounded-[1px] bg-chart-trend" />
          {WEIGHT_SCREEN.legend.trend}
        </span>
        <span className="flex items-center gap-[6px] text-caption text-text-secondary">
          <span aria-hidden className="size-[6px] rounded-pill bg-chart-point" />
          {WEIGHT_SCREEN.legend.weighIn}
        </span>
        <span className="flex items-center gap-[6px] text-caption text-text-secondary">
          <span aria-hidden className="size-2 rounded-pill border border-warning" />
          {WEIGHT_SCREEN.legend.leftOut}
        </span>
      </div>
    </div>
  );
}
