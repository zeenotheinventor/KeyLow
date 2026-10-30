import { useCallback, useState } from "react";

import type { PendingSet, PendingSets, ScreenSet } from "./sessionViewTypes";

export const NO_PENDING_SETS: readonly PendingSet[] = [];

/** Whether a set is one still being saved, which cannot be removed yet. */
export const isPendingSetId = (id: string): boolean => id.startsWith("pending-");

/** The stored sets with the pending ones after them, leaving out a pending one the stored sets already hold. */
export function withPendingSets(
  stored: readonly ScreenSet[],
  pending: readonly PendingSet[],
): readonly ScreenSet[] {
  const stillPending = pending.filter(
    ({ savedId }) => savedId === null || !stored.some((set) => set.id === savedId),
  );

  return stillPending.length === 0 ? stored : [...stored, ...stillPending.map(({ set }) => set)];
}

/**
 * The sets being saved. Not in the query cache: the cache is saved on the device, and a set that was never
 * stored must not come back after the app is closed.
 */
export function usePendingSets(): PendingSets {
  const [sets, setSets] = useState<readonly PendingSet[]>(NO_PENDING_SETS);

  const add = useCallback((set: ScreenSet) => {
    setSets((current) => [...current, { set, savedId: null }]);
  }, []);
  const markSaved = useCallback((pendingId: string, savedId: string) => {
    setSets((current) =>
      current.map((entry) => (entry.set.id === pendingId ? { ...entry, savedId } : entry)),
    );
  }, []);
  const drop = useCallback((pendingId: string) => {
    setSets((current) => current.filter((entry) => entry.set.id !== pendingId));
  }, []);
  const prune = useCallback((storedIds: ReadonlySet<string>) => {
    setSets((current) => {
      const kept = current.filter(({ savedId }) => savedId === null || !storedIds.has(savedId));

      return kept.length === current.length ? current : kept;
    });
  }, []);

  return { sets, add, markSaved, drop, prune };
}
