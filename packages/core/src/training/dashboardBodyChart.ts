/** The charts the dashboard's body map card can show, Heat first because Heat is the default. */
export const DASHBOARD_BODY_CHARTS = ["heat", "volume"] as const;

export type DashboardBodyChart = (typeof DASHBOARD_BODY_CHARTS)[number];

/** The chart a stored or typed value names, or nothing when it names none. */
export const dashboardBodyChartOf = (value: unknown): DashboardBodyChart | undefined =>
  DASHBOARD_BODY_CHARTS.find((chart) => chart === value);
