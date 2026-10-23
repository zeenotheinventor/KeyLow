import {
  defaultBodyMapRenderer,
  readBodyMapRenderer,
  writeBodyMapRenderer,
} from "./bodyMapRendererStorage";

import type { BodyMapRenderer } from "@keylow/core/training";

export type BodyMapRendererState = {
  renderer: BodyMapRenderer;
  /** False until the store has been read, and 2D until then. */
  isReady: boolean;
};

// How long the app waits for the stored renderer before it uses 2D: the phone answers at once, so a
// store that has not is stuck, and the body map must not wait on it for good. An answer that comes later
// is still applied.
const READ_TIMEOUT_MILLISECONDS = 3000;

const initialState: BodyMapRendererState = {
  renderer: defaultBodyMapRenderer,
  isReady: false,
};

/**
 * One renderer for the whole app, because the More row and the body map must change together. The store
 * is read once, from the first call to `startRead`, and every later call is ignored.
 */
export function createBodyMapRendererStore() {
  let state = initialState;
  let isReadStarted = false;
  const listeners = new Set<() => void>();

  const update = (next: BodyMapRendererState) => {
    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  // Whether the person has picked a renderer in this session, which a stored one must never replace.
  let hasChangedRenderer = false;

  const startRead = () => {
    if (isReadStarted) {
      return;
    }
    isReadStarted = true;
    let isSettled = false;
    const settle = (stored: BodyMapRenderer) => {
      if (isSettled) {
        if (!hasChangedRenderer) {
          update({ ...state, renderer: stored });
        }
        return;
      }
      isSettled = true;
      clearTimeout(timer);
      update(
        hasChangedRenderer ? { ...state, isReady: true } : { renderer: stored, isReady: true },
      );
    };
    const timer = setTimeout(() => {
      settle(defaultBodyMapRenderer);
    }, READ_TIMEOUT_MILLISECONDS);
    void readBodyMapRenderer().then(settle);
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
    setRenderer: (renderer: BodyMapRenderer) => {
      hasChangedRenderer = true;
      update({ ...state, renderer });
      void writeBodyMapRenderer(renderer);
    },
  };
}
