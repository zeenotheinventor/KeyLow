import { dashboardBodyChartOf } from "@keylow/core/training";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DashboardBodyChart } from "@keylow/core/training";

export const dashboardBodyChartStorageKey = "dashboard.bodyChart";
export const defaultDashboardBodyChart: DashboardBodyChart = "heat";

/** The chart last chosen on this device. Nothing valid saved, or a store that cannot be read, is Heat. */
export async function readDashboardBodyChart(): Promise<DashboardBodyChart> {
  try {
    const stored = await AsyncStorage.getItem(dashboardBodyChartStorageKey);
    return dashboardBodyChartOf(stored) ?? defaultDashboardBodyChart;
  } catch {
    return defaultDashboardBodyChart;
  }
}

/** A chart that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeDashboardBodyChart(chart: DashboardBodyChart): Promise<void> {
  try {
    await AsyncStorage.setItem(dashboardBodyChartStorageKey, chart);
  } catch {
    // Nothing to do: the next visit starts from the last chart that did save.
  }
}
