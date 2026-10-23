import { useEffect, useSyncExternalStore } from "react";

import { currentBodyFigureStore } from "./currentBodyFigureStore";

import type { BodyArtworkFigure } from "@keylow/core/training";

/** Starts reading the stored figure, as the app starts, so a screen finds it read. Asking again does nothing. */
export function startBodyFigureRead(): void {
  currentBodyFigureStore.store.startRead();
}

const subscribe = (listener: () => void) => currentBodyFigureStore.store.subscribe(listener);
const getSnapshot = () => currentBodyFigureStore.store.getSnapshot();
const setFigure = (figure: BodyArtworkFigure) => {
  currentBodyFigureStore.store.setFigure(figure);
};

/**
 * The figure the body is drawn as, male or female, remembered per device and shared by every screen that
 * draws one. It is Male until the store has been read, so a screen that must not draw the wrong figure
 * waits for `isReady`. `hasChosen` is false until the person has answered the question: a store that
 * cannot be read counts as answered, so the person is never asked a question that cannot be saved.
 */
export function useBodyFigure(): {
  figure: BodyArtworkFigure;
  isReady: boolean;
  hasChosen: boolean;
  setFigure: (figure: BodyArtworkFigure) => void;
} {
  const state = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    startBodyFigureRead();
  }, []);

  return { ...state, setFigure };
}
