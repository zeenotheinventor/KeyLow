import { useSyncExternalStore } from "react";

import {
  getHealthImportState,
  importHealthNow,
  subscribeToHealthImport,
} from "./healthImportStore";

/**
 * The shared state of the weight import, to read from any screen: whether one is running, when one last
 * ended well, and the last result (its `inserted` count is what the Health flow shows). `importNow` asks
 * the runner in the root layout for an import, and joins one that is running. It starts nothing itself,
 * so a screen can call this freely. It is `unavailable` where there is no runner (no Health provider).
 */
export function useHealthImport() {
  const state = useSyncExternalStore(subscribeToHealthImport, getHealthImportState);

  return {
    importNow: importHealthNow,
    isImporting: state.isImporting,
    lastImportedAt: state.lastImportedAt,
    lastResult: state.lastResult,
  };
}
