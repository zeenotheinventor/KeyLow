import { useSyncExternalStore } from "react";

import { currentDashboardBodyChartStore } from "./currentDashboardBodyChartStore";
import { DEFAULT_DASHBOARD_BODY_CHART } from "./dashboardBodyChartStorage";

import type { DashboardBodyChart } from "@keylow/core/training";

const subscribe = (listener: () => void) =>
  currentDashboardBodyChartStore.store.subscribe(listener);
const getSnapshot = () => currentDashboardBodyChartStore.store.getSnapshot();
const getServerSnapshot = () => currentDashboardBodyChartStore.store.getServerSnapshot();
const setChart = (chart: DashboardBodyChart) => {
  currentDashboardBodyChartStore.store.setChart(chart);
};

/**
 * The chart the dashboard's body map card draws, Heat or Weekly volume, remembered in this browser and
 * shared by every reader. The server has no storage, so it is not known there or on the first draw in the
 * browser: the chart is Heat until `isReady`, and a card that must not draw the wrong one waits for it.
 * Nothing saved, a value that is not a chart or storage that cannot be read is Heat.
 */
export function useDashboardBodyChart(): {
  chart: DashboardBodyChart;
  isReady: boolean;
  setChart: (chart: DashboardBodyChart) => void;
} {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { chart: stored ?? DEFAULT_DASHBOARD_BODY_CHART, isReady: stored !== null, setChart };
}
