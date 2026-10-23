import { defaultBodyFigure, readBodyFigure, writeBodyFigure } from "./bodyFigureStorage";

import type { BodyArtworkFigure } from "@keylow/core/training";

export type BodyFigureState = {
  figure: BodyArtworkFigure;
  /** False until the store has been read, and Male until then. */
  isReady: boolean;
  /** Whether the person has answered the question already, by choosing or by closing it. */
  hasChosen: boolean;
};

// How long the app waits for the stored figure before it uses Male: the phone answers at once, so a store
// that has not is stuck, and a screen must not wait on it for good. The wait starts as the app loads, so a
// slow cold start is allowed three seconds, and an answer that comes later is still applied.
const READ_TIMEOUT_MILLISECONDS = 3000;

const initialState: BodyFigureState = {
  figure: defaultBodyFigure,
  isReady: false,
  hasChosen: false,
};

/**
 * One figure for the whole app, because the dashboard card sits under the body map screen and must change
 * when the screen's sheet does. The store is read once, from the first call to `startRead`, and every
 * later call is ignored.
 */
export function createBodyFigureStore() {
  let state = initialState;
  let isReadStarted = false;
  const listeners = new Set<() => void>();

  const update = (next: BodyFigureState) => {
    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  // Whether the person has picked a figure in this session, which a stored one must never replace.
  let hasChangedFigure = false;

  const startRead = () => {
    if (isReadStarted) {
      return;
    }
    isReadStarted = true;
    let isSettled = false;
    const settle = (stored: { figure: BodyArtworkFigure; hasChosen: boolean }) => {
      if (isSettled) {
        // An answer after the wait gave up is the figure stored, so it is drawn, but the person is not asked.
        if (!hasChangedFigure) {
          update({ ...state, figure: stored.figure });
        }
        return;
      }
      isSettled = true;
      clearTimeout(timer);
      update(hasChangedFigure ? { ...state, isReady: true } : { ...stored, isReady: true });
    };
    const timer = setTimeout(() => {
      settle({ figure: defaultBodyFigure, hasChosen: true });
    }, READ_TIMEOUT_MILLISECONDS);
    void readBodyFigure().then(settle);
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
    setFigure: (figure: BodyArtworkFigure) => {
      hasChangedFigure = true;
      update({ ...state, figure, hasChosen: true });
      void writeBodyFigure(figure);
    },
  };
}
