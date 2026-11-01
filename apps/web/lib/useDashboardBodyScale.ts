import { isDashboardBodyScale } from "@keylow/core/training";
import { useSyncExternalStore } from "react";

import type { DashboardBodyScale } from "@keylow/core/training";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

export const DASHBOARD_BODY_SCALE_KEY = "bodyMap.dashboardScale";
const DEFAULT_SCALE: DashboardBodyScale = "heat";

// One store for the whole app, so the More page and the dashboard card change together. A choice is held
// here as well as saved, so one that cannot be saved still applies for the visit.
let chosen: DashboardBodyScale | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

// This reads the stored preference during render, which is safe only because the server snapshot is null,
// so a reuse must keep that.
const read = (): DashboardBodyScale =>
  chosen ?? readLocalPreference(DASHBOARD_BODY_SCALE_KEY, isDashboardBodyScale) ?? DEFAULT_SCALE;

const choose = (next: DashboardBodyScale) => {
  chosen = next;
  writeLocalPreference(DASHBOARD_BODY_SCALE_KEY, next);
  for (const listener of listeners) {
    listener();
  }
};

// The server has no storage, so what it draws has not read the saved chart. The client draws the same on
// its first render, and then reads it.
const readOnServer = () => null;

/** Forgets a choice made in this visit, so each test starts from what storage holds. For tests only. */
export function resetDashboardBodyScaleForTests(): void {
  chosen = null;
}

/**
 * The chart the dashboard's body map card draws, Heat or Weekly volume, remembered on this device and
 * shared by every reader. It is not known on the server or on the first draw in the browser, so a reader
 * that must not draw the wrong chart waits for `isRead`. Nothing saved, a value that is not a chart, or
 * blocked storage leave Heat.
 */
export function useDashboardBodyScale(): {
  scale: DashboardBodyScale;
  isRead: boolean;
  setScale: (scale: DashboardBodyScale) => void;
} {
  const scale = useSyncExternalStore(subscribe, read, readOnServer);

  return { scale: scale ?? DEFAULT_SCALE, isRead: scale !== null, setScale: choose };
}
