import { currentDashboardBodyScaleStore } from "./currentDashboardBodyScaleStore";
import { createDashboardBodyScaleStore } from "./dashboardBodyScaleStore";

/** Forgets what was read and chosen, so each test starts from a fresh install. For tests only. */
export function resetDashboardBodyScaleForTests(): void {
  currentDashboardBodyScaleStore.store = createDashboardBodyScaleStore();
}
