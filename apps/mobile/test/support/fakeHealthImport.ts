import { useSyncExternalStore } from "react";

import type { HealthImportResult } from "../../lib/health";

type FakeHealthImportState = {
  isImporting: boolean;
  lastImportedAt: string | null;
  lastResult: HealthImportResult | null;
};

const initialState: FakeHealthImportState = {
  isImporting: false,
  lastImportedAt: null,
  lastResult: null,
};

let state = initialState;
const listeners = new Set<() => void>();

/**
 * The shared import state of `useHealthImport`, set directly by a test, with `importNow` a mock it scripts.
 * A test mocks `lib/health/useHealthImport` so the hook is `useFakeHealthImport`. A change reaches every screen
 * that reads the hook, as the real store's does.
 */
export const fakeHealthImport = {
  importNow: jest.fn<Promise<HealthImportResult>, []>(),
  set(next: Partial<FakeHealthImportState>): void {
    state = { ...state, ...next };
    listeners.forEach((listener) => {
      listener();
    });
  },
  reset(): void {
    state = initialState;
    fakeHealthImport.importNow.mockReset();
    fakeHealthImport.importNow.mockResolvedValue({
      status: "nothing-new",
      read: 0,
      skipped: 0,
      inserted: 0,
    });
  },
};

export function useFakeHealthImport() {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );

  return { importNow: fakeHealthImport.importNow, ...current };
}
