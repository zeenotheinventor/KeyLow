import { useSyncExternalStore } from "react";

import { DEFAULT_BODY_FIGURE } from "./bodyFigureStorage";
import { currentBodyFigureStore } from "./currentBodyFigureStore";

import type { BodyArtworkFigure } from "@keylow/core/training";

const subscribe = (listener: () => void) => currentBodyFigureStore.store.subscribe(listener);
const getSnapshot = () => currentBodyFigureStore.store.getSnapshot();
const getServerSnapshot = () => currentBodyFigureStore.store.getServerSnapshot();
const setFigure = (figure: BodyArtworkFigure) => {
  currentBodyFigureStore.store.setFigure(figure);
};

/**
 * The figure the body is drawn as, male or female, remembered in this browser and shared by every screen
 * that draws one. The server has no storage, so it is not known there or on the first draw in the browser:
 * the figure is Male until `isReady`, and a screen that must not draw the wrong figure waits for it.
 * `hasChosen` is false only once the store is read and holds no answer to the question. A store that cannot
 * be read counts as answered, so the person is never asked a question that cannot be saved.
 */
export function useBodyFigure(): {
  figure: BodyArtworkFigure;
  isReady: boolean;
  hasChosen: boolean;
  setFigure: (figure: BodyArtworkFigure) => void;
} {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    figure: stored?.figure ?? DEFAULT_BODY_FIGURE,
    isReady: stored !== null,
    hasChosen: stored?.hasChosen ?? true,
    setFigure,
  };
}
