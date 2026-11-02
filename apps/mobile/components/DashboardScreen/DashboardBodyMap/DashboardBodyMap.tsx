import { useDashboardBodyChart } from "../../../lib/dashboardBodyChart";
import { DashboardHeatBodyMap } from "../DashboardHeatBodyMap";
import { DashboardVolumeBodyMap } from "../DashboardVolumeBodyMap";

import type { DashboardBodyMapProps } from "./types";

/**
 * The body map card, once the Dashboard is up, in the chart chosen in More: Heat (the default, Actual heat
 * now) or Weekly volume (this week's Actual volume). Each has the reads it needs and no others, so Heat
 * makes none of Volume's. The choice is kept per device and the card follows a change at once. Until the
 * stored choice has been read the card shows its skeleton rather than Heat, so it never draws the wrong
 * chart first.
 */
export function DashboardBodyMap({ isReadEnabled }: DashboardBodyMapProps) {
  const { chart, isReady: isChartReady } = useDashboardBodyChart();

  return chart === "volume" ? (
    <DashboardVolumeBodyMap isReadEnabled={isReadEnabled} />
  ) : (
    <DashboardHeatBodyMap isChartReady={isChartReady} isReadEnabled={isReadEnabled} />
  );
}
