import { useEffect, useSyncExternalStore } from "react";

import { currentBodyMapRendererStore } from "./currentBodyMapRendererStore";

import type { BodyMapRenderer } from "@keylow/core/training";

/** Starts reading the stored renderer, as the app starts, so a reader finds it read. Asking again does nothing. */
export function startBodyMapRendererRead(): void {
  currentBodyMapRendererStore.store.startRead();
}

const subscribe = (listener: () => void) => currentBodyMapRendererStore.store.subscribe(listener);
const getSnapshot = () => currentBodyMapRendererStore.store.getSnapshot();
const setRenderer = (renderer: BodyMapRenderer) => {
  currentBodyMapRendererStore.store.setRenderer(renderer);
};

/**
 * The renderer the body map is drawn with, 2D or 3D, remembered per device and shared by every reader.
 * It is 2D until the store has been read, so a reader that must not draw the wrong one waits for
 * `isReady`. A store that cannot be read is 2D.
 */
export function useBodyMapRenderer(): {
  renderer: BodyMapRenderer;
  isReady: boolean;
  setRenderer: (renderer: BodyMapRenderer) => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    startBodyMapRendererRead();
  }, []);

  return { ...state, setRenderer };
}
