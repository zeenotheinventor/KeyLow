"use client";

import { MORE_SCREEN } from "@keylow/core/copy";
import { useId } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useDashboardBodyChart } from "@/lib/dashboardBodyChart";

const { dashboardBodyChart } = MORE_SCREEN.settings;

const chartOptions = [
  { value: "heat", label: dashboardBodyChart.options.heat },
  { value: "volume", label: dashboardBodyChart.options.volume },
] as const;

/**
 * A row of the Settings group, drawn as the Appearance row is: the label, and the choice of Heat or Weekly
 * volume for the dashboard's body map card, with a caption under it that says what the chosen one shows.
 * The choice applies at once and is kept in this browser.
 */
export function DashboardBodyChartSetting() {
  const labelId = useId();
  const { chart, setChart } = useDashboardBodyChart();

  return (
    <li className="flex flex-col gap-2 p-3">
      <span id={labelId} className="text-body-strong">
        {dashboardBodyChart.title}
      </span>
      <SegmentedControl
        labelledBy={labelId}
        options={chartOptions}
        value={chart}
        onChange={setChart}
      />
      <p className="px-1 text-caption text-text-secondary">{dashboardBodyChart.captions[chart]}</p>
    </li>
  );
}
