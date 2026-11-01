"use client";

import { MORE_SCREEN } from "@keylow/core/copy";
import { useId } from "react";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useDashboardBodyScale } from "@/lib/useDashboardBodyScale";

const { dashboardChart } = MORE_SCREEN.settings;

const dashboardChartOptions = [
  { value: "heat", label: dashboardChart.options.heat },
  { value: "volume", label: dashboardChart.options.volume },
] as const;

/**
 * A row of the Settings group, drawn as Appearance is: the label, and the choice of the dashboard body
 * chart, Heat or Weekly volume. The choice applies at once and is kept on this device. Under Weekly volume
 * the row says which days the week counts.
 */
export function DashboardChartSetting() {
  const labelId = useId();
  const { scale, setScale } = useDashboardBodyScale();

  return (
    <li className="flex flex-col gap-2 p-3">
      <span id={labelId} className="text-body-strong">
        {dashboardChart.title}
      </span>
      <SegmentedControl
        labelledBy={labelId}
        options={dashboardChartOptions}
        value={scale}
        onChange={setScale}
      />
      {scale === "volume" ? (
        <p className="px-1 text-caption text-text-secondary">{dashboardChart.volumeNote}</p>
      ) : null}
    </li>
  );
}
