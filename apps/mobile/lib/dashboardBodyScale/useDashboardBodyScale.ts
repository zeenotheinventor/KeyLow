import { useEffect, useSyncExternalStore } from "react";

import { currentDashboardBodyScaleStore } from "./currentDashboardBodyScaleStore";

import type { DashboardBodyScale } from "@keylow/core/training";

/** Starts reading the stored dashboard chart, as the app starts, so a reader finds it read. Asking again does nothing. */
export function startDashboardBodyScaleRead(): void {
  currentDashboardBodyScaleStore.store.startRead();
}

const subscribe = (listener: () => void) =>
  currentDashboardBodyScaleStore.store.subscribe(listener);
const getSnapshot = () => currentDashboardBodyScaleStore.store.getSnapshot();
const setScale = (scale: DashboardBodyScale) => {
  currentDashboardBodyScaleStore.store.setScale(scale);
};

/**
 * The chart the dashboard's body map card draws, heat or weekly volume, remembered per device and shared
 * by every reader. It is heat until the store has been read, so a reader that must not draw the wrong one
 * waits for `isReady`. A store that cannot be read is heat.
 */
export function useDashboardBodyScale(): {
  scale: DashboardBodyScale;
  isReady: boolean;
  setScale: (scale: DashboardBodyScale) => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    startDashboardBodyScaleRead();
  }, []);

  return { ...state, setScale };
}
