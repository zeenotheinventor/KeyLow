import { DashboardBodyMapLoading } from "../DashboardBodyMapLoading";
import { DashboardHeatBodyMap } from "../DashboardHeatBodyMap";
import { DashboardVolumeBodyMap } from "../DashboardVolumeBodyMap";

import { useDashboardBodyChart } from "@/lib/dashboardBodyChart";

/**
 * The body map card, once the dashboard is up, in the chart chosen in More: Heat (the default, Actual heat
 * now) or Weekly volume (this week's Actual volume). Each has the reads it needs and no others, so Heat
 * makes none of Volume's. The choice is kept in this browser and the card follows a change at once. Until
 * the stored choice is known, which it is not on the server or on the first draw in the browser, the card
 * shows its skeleton rather than Heat, so it never draws the wrong chart first.
 */
export function DashboardBodyMap() {
  const { chart, isReady } = useDashboardBodyChart();

  if (!isReady) {
    return <DashboardBodyMapLoading />;
  }
  return chart === "volume" ? <DashboardVolumeBodyMap /> : <DashboardHeatBodyMap />;
}
