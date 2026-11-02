import {
  defaultDashboardBodyChart,
  readDashboardBodyChart,
  writeDashboardBodyChart,
} from "./dashboardBodyChartStorage";

import type { DashboardBodyChart } from "@keylow/core/training";

export type DashboardBodyChartState = {
  chart: DashboardBodyChart;
  /** False until the store has been read, and Heat until then. */
  isReady: boolean;
};

// How long the dashboard waits for the stored chart before it uses Heat: the phone answers at once, so a
// store that has not is stuck, and the card must not wait on it for good. An answer that comes later is
// still applied.
const READ_TIMEOUT_MILLISECONDS = 3000;

const initialState: DashboardBodyChartState = {
  chart: defaultDashboardBodyChart,
  isReady: false,
};

/**
 * One chart for the whole app, because the More row and the dashboard card must change together. The store
 * is read once, from the first call to `startRead`, and every later call is ignored.
 */
export function createDashboardBodyChartStore() {
  let state = initialState;
  let isReadStarted = false;
  // Whether the person has picked a chart in this session, which a stored one must never replace.
  let hasChangedChart = false;
  const listeners = new Set<() => void>();

  const update = (next: DashboardBodyChartState) => {
    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  const startRead = () => {
    if (isReadStarted) {
      return;
    }
    isReadStarted = true;
    let isSettled = false;
    const settle = (stored: DashboardBodyChart) => {
      if (isSettled) {
        if (!hasChangedChart) {
          update({ ...state, chart: stored });
        }
        return;
      }
      isSettled = true;
      clearTimeout(timer);
      update(hasChangedChart ? { ...state, isReady: true } : { chart: stored, isReady: true });
    };
    const timer = setTimeout(() => {
      settle(defaultDashboardBodyChart);
    }, READ_TIMEOUT_MILLISECONDS);
    void readDashboardBodyChart().then(settle);
  };

  return {
    startRead,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setChart: (chart: DashboardBodyChart) => {
      hasChangedChart = true;
      update({ ...state, chart });
      void writeDashboardBodyChart(chart);
    },
  };
}
