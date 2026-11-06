import { useCallback, useState, useSyncExternalStore } from "react";

import { readLocalPreferenceState, writeLocalPreference } from "@/lib/localPreference";

export const BODY_MAP_HINT_KEY = "bodyMap.hintSeen";
const SEEN = "true";

const isSeenMark = (stored: string): stored is typeof SEEN => stored === SEEN;

// One store for each screen. Marking the hint seen is held here as well as saved, so a mark that cannot be
// saved still hides the hint for the visit.
function createHintStore() {
  let isMarked = false;
  const listeners = new Set<() => void>();

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    // This reads the stored mark during render, which is safe only because the server snapshot is null, so a reuse must keep that.
    // Storage that cannot be read counts as seen, so the hint is never shown from a guess.
    read: (): boolean => {
      if (isMarked) {
        return true;
      }
      return readLocalPreferenceState(BODY_MAP_HINT_KEY, isSeenMark).status !== "empty";
    },
    markSeen: () => {
      isMarked = true;
      writeLocalPreference(BODY_MAP_HINT_KEY, SEEN);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

// The server has no storage, so what it draws has not read the mark. The browser draws the same on its first
// render, and then reads it, so a hint that was dismissed is never drawn and so never flashes.
const readOnServer = () => null;

/**
 * Whether the body map's first-open hint has been seen, remembered in this browser. It is not known on the
 * server or on the first draw in the browser, so a screen that must not flash the hint waits for `isRead`.
 * `markSeen` hides the hint at once and stores that.
 */
export function useBodyMapHint(): {
  isRead: boolean;
  hasSeen: boolean;
  markSeen: () => void;
} {
  const [store] = useState(createHintStore);
  const seen = useSyncExternalStore(store.subscribe, store.read, readOnServer);
  const markSeen = useCallback(() => {
    store.markSeen();
  }, [store]);

  return { isRead: seen !== null, hasSeen: seen ?? false, markSeen };
}
