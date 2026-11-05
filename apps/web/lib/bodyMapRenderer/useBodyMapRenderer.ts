import { useSyncExternalStore } from "react";

import { DEFAULT_BODY_MAP_RENDERER } from "./bodyMapRendererStorage";
import { currentBodyMapRendererStore } from "./currentBodyMapRendererStore";

import type { BodyMapRenderer } from "@keylow/core/training";

const subscribe = (listener: () => void) => currentBodyMapRendererStore.store.subscribe(listener);
const getSnapshot = () => currentBodyMapRendererStore.store.getSnapshot();
const getServerSnapshot = () => currentBodyMapRendererStore.store.getServerSnapshot();
const setRenderer = (renderer: BodyMapRenderer) => {
  currentBodyMapRendererStore.store.setRenderer(renderer);
};

/**
 * Whether the body map is drawn in 2D or in 3D, remembered in this browser and shared by every reader. The
 * server has no storage, so it is not known there or on the first draw in the browser: the renderer is 2D
 * until `isReady`, and a screen that must not draw the wrong one waits for it. Nothing saved, a value that
 * is not a renderer or storage that cannot be read is 2D.
 */
export function useBodyMapRenderer(): {
  renderer: BodyMapRenderer;
  isReady: boolean;
  setRenderer: (renderer: BodyMapRenderer) => void;
} {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return { renderer: stored ?? DEFAULT_BODY_MAP_RENDERER, isReady: stored !== null, setRenderer };
}
