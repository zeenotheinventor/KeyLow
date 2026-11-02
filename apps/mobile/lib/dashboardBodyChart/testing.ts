import { currentDashboardBodyChartStore } from "./currentDashboardBodyChartStore";
import { createDashboardBodyChartStore } from "./dashboardBodyChartStore";

/** Forgets what was read and chosen, so each test starts from a fresh install. For tests only. */
export function resetDashboardBodyChartForTests(): void {
  currentDashboardBodyChartStore.store = createDashboardBodyChartStore();
}
