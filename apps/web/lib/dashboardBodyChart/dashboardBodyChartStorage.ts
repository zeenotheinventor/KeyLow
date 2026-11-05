import { dashboardBodyChartOf } from "@keylow/core/training";

import type { DashboardBodyChart } from "@keylow/core/training";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

/** The key the phone saves the same choice under. */
export const DASHBOARD_BODY_CHART_KEY = "dashboard.bodyChart";
export const DEFAULT_DASHBOARD_BODY_CHART: DashboardBodyChart = "heat";

const isDashboardBodyChart = (stored: string): stored is DashboardBodyChart =>
  dashboardBodyChartOf(stored) !== undefined;

/**
 * The chart last chosen in this browser. Nothing valid saved, a value that is not a chart, or storage that
 * cannot be read is Heat. Call it from an effect, an event handler or a store read behind a null server
 * snapshot, not from a render that the server also runs.
 */
export function readDashboardBodyChart(): DashboardBodyChart {
  return (
    readLocalPreference(DASHBOARD_BODY_CHART_KEY, isDashboardBodyChart) ??
    DEFAULT_DASHBOARD_BODY_CHART
  );
}

/** A chart that cannot be saved still applies for the visit, so the failure is not raised. */
export function writeDashboardBodyChart(chart: DashboardBodyChart): void {
  writeLocalPreference(DASHBOARD_BODY_CHART_KEY, chart);
}
