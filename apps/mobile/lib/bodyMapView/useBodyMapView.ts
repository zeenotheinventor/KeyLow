import { useCallback, useEffect, useState } from "react";

import { defaultBodyMapView, readBodyMapView, writeBodyMapView } from "./bodyMapViewStore";

import type { BodyMapView } from "@keylow/core/training";

// How long a screen waits for the stored view before it shows Actual: the phone answers at once, so a
// store that has not is stuck, and the screen must not wait on it for good.
const READ_TIMEOUT_MILLISECONDS = 1000;

// The hook instances that are mounted, so a choice made on one screen reaches the others. The body map stays
// mounted under the muscle list, and the view chosen on the list is the one the map shows when it returns.
const mountedChoices = new Set<(view: BodyMapView) => void>();

/**
 * The view the body map shows, Actual or Projected, remembered per device. It is Actual until the store
 * has been read, so a screen that must not draw the wrong view waits for `isRead`. A store that cannot be
 * read leaves Actual, and so does one that has not answered in a second, whose late answer is ignored.
 */
export function useBodyMapView(): {
  view: BodyMapView;
  isRead: boolean;
  setView: (view: BodyMapView) => void;
} {
  const [view, setViewState] = useState<BodyMapView>(defaultBodyMapView);
  const [isRead, setIsRead] = useState(false);

  useEffect(() => {
    let isSettled = false;
    const settle = (stored: BodyMapView) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        setViewState(stored);
        setIsRead(true);
      }
    };
    const timer = setTimeout(() => {
      settle(defaultBodyMapView);
    }, READ_TIMEOUT_MILLISECONDS);
    void readBodyMapView().then(settle);
    // A choice made elsewhere is a choice: it ends the wait for the stored view and ignores a late answer.
    const follow = (chosen: BodyMapView) => {
      isSettled = true;
      clearTimeout(timer);
      setViewState(chosen);
      setIsRead(true);
    };
    mountedChoices.add(follow);

    return () => {
      mountedChoices.delete(follow);
      isSettled = true;
      clearTimeout(timer);
    };
  }, []);

  const setView = useCallback((next: BodyMapView) => {
    setViewState(next);
    for (const follow of mountedChoices) {
      follow(next);
    }
    void writeBodyMapView(next);
  }, []);

  return { view, isRead, setView };
}
