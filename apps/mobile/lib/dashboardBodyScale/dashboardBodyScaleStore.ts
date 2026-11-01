import {
  defaultDashboardBodyScale,
  readDashboardBodyScale,
  writeDashboardBodyScale,
} from "./dashboardBodyScaleStorage";

import type { DashboardBodyScale } from "@keylow/core/training";

export type DashboardBodyScaleState = {
  scale: DashboardBodyScale;
  /** False until the store has been read, and heat until then. */
  isReady: boolean;
};

// How long the app waits for the stored chart before it uses heat: the phone answers at once, so a store
// that has not is stuck, and the dashboard must not wait on it for good. An answer that comes later is
// still applied.
const READ_TIMEOUT_MILLISECONDS = 3000;

const initialState: DashboardBodyScaleState = {
  scale: defaultDashboardBodyScale,
  isReady: false,
};

/**
 * One dashboard chart for the whole app, because the More row and the dashboard card must change
 * together. The store is read once, from the first call to `startRead`, and every later call is ignored.
 */
export function createDashboardBodyScaleStore() {
  let state = initialState;
  let isReadStarted = false;
  const listeners = new Set<() => void>();

  const update = (next: DashboardBodyScaleState) => {
    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  // Whether the person has picked a chart in this session, which a stored one must never replace.
  let hasChangedScale = false;

  const startRead = () => {
    if (isReadStarted) {
      return;
    }
    isReadStarted = true;
    let isSettled = false;
    const settle = (stored: DashboardBodyScale) => {
      if (isSettled) {
        if (!hasChangedScale) {
          update({ ...state, scale: stored });
        }
        return;
      }
      isSettled = true;
      clearTimeout(timer);
      update(hasChangedScale ? { ...state, isReady: true } : { scale: stored, isReady: true });
    };
    const timer = setTimeout(() => {
      settle(defaultDashboardBodyScale);
    }, READ_TIMEOUT_MILLISECONDS);
    void readDashboardBodyScale().then(settle);
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
    setScale: (scale: DashboardBodyScale) => {
      hasChangedScale = true;
      update({ ...state, scale });
      void writeDashboardBodyScale(scale);
    },
  };
}
