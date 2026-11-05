import { readDashboardBodyChart, writeDashboardBodyChart } from "./dashboardBodyChartStorage";

import type { DashboardBodyChart } from "@keylow/core/training";

/**
 * One chart for the whole site, because the More row and the dashboard card must change together. The
 * browser's storage is read once, on the first read in the browser, and the chart is held here from then
 * on, so a choice that cannot be saved still applies for the visit.
 */
export function createDashboardBodyChartStore() {
  let chart: DashboardBodyChart | null = null;
  const listeners = new Set<() => void>();

  return {
    // This reads storage during render, which is safe only because the server snapshot is null, so the
    // server and the first draw in the browser agree. A reuse must keep that.
    getSnapshot: (): DashboardBodyChart => (chart ??= readDashboardBodyChart()),
    getServerSnapshot: (): DashboardBodyChart | null => null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setChart: (next: DashboardBodyChart) => {
      chart = next;
      writeDashboardBodyChart(next);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
