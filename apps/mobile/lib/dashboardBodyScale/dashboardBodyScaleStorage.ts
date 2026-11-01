import { isDashboardBodyScale } from "@keylow/core/training";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { DashboardBodyScale } from "@keylow/core/training";

export const dashboardBodyScaleStorageKey = "bodyMap.dashboardScale";
export const defaultDashboardBodyScale: DashboardBodyScale = "heat";

/** The dashboard chart last chosen on this device. Nothing valid saved, or a store that cannot be read, is heat. */
export async function readDashboardBodyScale(): Promise<DashboardBodyScale> {
  try {
    const stored = await AsyncStorage.getItem(dashboardBodyScaleStorageKey);
    return isDashboardBodyScale(stored) ? stored : defaultDashboardBodyScale;
  } catch {
    return defaultDashboardBodyScale;
  }
}

/** A chart that cannot be saved still applies for this visit, so the failure is not raised. */
export async function writeDashboardBodyScale(scale: DashboardBodyScale): Promise<void> {
  try {
    await AsyncStorage.setItem(dashboardBodyScaleStorageKey, scale);
  } catch {
    // Nothing to do: the next visit starts from the last chart that did save.
  }
}
