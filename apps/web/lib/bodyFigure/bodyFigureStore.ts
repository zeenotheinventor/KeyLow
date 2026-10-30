import { readBodyFigure, writeBodyFigure } from "./bodyFigureStorage";

import type { StoredBodyFigure } from "./bodyFigureStorage";
import type { BodyArtworkFigure } from "@keylow/core/training";

/**
 * One figure for the whole site, because the dashboard card and the body map page must draw the same one
 * and a change on the page must reach the card. The browser's storage is read once, on the first read in
 * the browser, and the figure is held here from then on, so a choice that cannot be saved still applies
 * for the visit.
 */
export function createBodyFigureStore() {
  let state: StoredBodyFigure | null = null;
  const listeners = new Set<() => void>();

  return {
    // This reads storage during render, which is safe only because the server snapshot is null, so the
    // server and the first draw in the browser agree. A reuse must keep that.
    getSnapshot: (): StoredBodyFigure => (state ??= readBodyFigure()),
    getServerSnapshot: (): StoredBodyFigure | null => null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setFigure: (figure: BodyArtworkFigure) => {
      state = { figure, hasChosen: true };
      writeBodyFigure(figure);
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
