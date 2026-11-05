import { useState, useSyncExternalStore } from "react";

import type { BodyMapView } from "@keylow/core/training";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

export const BODY_MAP_VIEW_KEY = "bodyMap.view";
const DEFAULT_VIEW: BodyMapView = "actual";

const isBodyMapView = (stored: string): stored is BodyMapView =>
  stored === "actual" || stored === "projected";

// One store for each screen. A choice is held here as well as saved, so one that cannot be saved still
// applies for the visit.
function createViewStore() {
  let chosen: BodyMapView | null = null;
  const listeners = new Set<() => void>();

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // This reads the stored preference during render, which is safe only because the server snapshot is null, so a reuse must keep that.
    read: (): BodyMapView =>
      chosen ?? readLocalPreference(BODY_MAP_VIEW_KEY, isBodyMapView) ?? DEFAULT_VIEW,
    choose: (next: BodyMapView) => {
      chosen = next;
      writeLocalPreference(BODY_MAP_VIEW_KEY, next);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

// The server has no storage, so what it draws has not read the saved view. The client draws the same on
// its first render, and then reads it.
const readOnServer = () => null;

/**
 * The view the body map shows, Actual or Projected, remembered on this device. It is not known on the
 * server or on the first draw in the browser, so a screen that must not draw the wrong view waits for
 * `isRead`. Nothing saved, a value that is not a view, or blocked storage leave Actual.
 */
export function useBodyMapView(): {
  view: BodyMapView;
  isRead: boolean;
  setView: (view: BodyMapView) => void;
} {
  const [store] = useState(createViewStore);
  const view = useSyncExternalStore(store.subscribe, store.read, readOnServer);

  return { view: view ?? DEFAULT_VIEW, isRead: view !== null, setView: store.choose };
}
