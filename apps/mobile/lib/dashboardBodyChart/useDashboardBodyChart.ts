import { useEffect, useSyncExternalStore } from "react";

import { currentDashboardBodyChartStore } from "./currentDashboardBodyChartStore";

import type { DashboardBodyChart } from "@keylow/core/training";

/** Starts reading the stored chart, as the app starts, so a reader finds it read. Asking again does nothing. */
export function startDashboardBodyChartRead(): void {
  currentDashboardBodyChartStore.store.startRead();
}

const subscribe = (listener: () => void) =>
  currentDashboardBodyChartStore.store.subscribe(listener);
const getSnapshot = () => currentDashboardBodyChartStore.store.getSnapshot();
const setChart = (chart: DashboardBodyChart) => {
  currentDashboardBodyChartStore.store.setChart(chart);
};

/**
 * The chart the dashboard's body map card draws, Heat or Weekly volume, remembered per device and shared by
 * every reader. It is Heat until the store has been read, so a reader that must not draw the wrong one
 * waits for `isReady`. A store that cannot be read is Heat.
 */
export function useDashboardBodyChart(): {
  chart: DashboardBodyChart;
  isReady: boolean;
  setChart: (chart: DashboardBodyChart) => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    startDashboardBodyChartRead();
  }, []);

  return { ...state, setChart };
}
