import { parseWidgetSnapshot } from "@keylow/core/widgets";

import type { WidgetBridge } from "./types";
import type { PendingUndo, WidgetSnapshot } from "@keylow/core/widgets";

/** A bridge that keeps everything in memory, for tests. `redrawCount` says how often a redraw was asked for. */
export function createInMemoryWidgetBridge(): WidgetBridge & {
  readonly redrawCount: () => number;
} {
  let snapshot: WidgetSnapshot | null = null;
  let pendingUndo: PendingUndo | null = null;
  let redraws = 0;

  return {
    writeSnapshot: (next) => {
      snapshot = next;
      return Promise.resolve();
    },
    readSnapshot: () => Promise.resolve(parseWidgetSnapshot(snapshot)),
    writePendingUndo: (next) => {
      pendingUndo = next;
      return Promise.resolve();
    },
    readPendingUndo: () => Promise.resolve(pendingUndo),
    clearPendingUndo: () => {
      pendingUndo = null;
      return Promise.resolve();
    },
    clear: () => {
      snapshot = null;
      pendingUndo = null;
      return Promise.resolve();
    },
    requestRedraw: () => {
      redraws += 1;
      return Promise.resolve();
    },
    redrawCount: () => redraws,
  };
}
