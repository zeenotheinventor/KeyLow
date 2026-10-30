import { keys } from "./queryKeys";

import type { QueryClient } from "@tanstack/react-query";

/*
 * What the two accepted suggestion writes (accept into a day, and its Undo) share. They need a
 * connection: nothing is queued, and nothing is replayed from storage.
 */

const lastWrite = new WeakMap<QueryClient, Promise<unknown>>();

/**
 * Runs `write` after every accepted suggestion write that was started before it has settled, whether
 * it succeeded or failed, so an Undo tapped while an accept is on its way waits for it and the last
 * edit wins. Writes are ordered per query client, across the two hooks. It is the order that a
 * mutation scope gives, kept here because a scope queues a repeated press of Accept behind the first,
 * which then replaces its own row, while `useSingleFlight` joins it.
 */
export function afterEarlierAcceptedSuggestionWrites<Output>(
  queryClient: QueryClient,
  write: () => Promise<Output>,
): Promise<Output> {
  const earlier = lastWrite.get(queryClient) ?? Promise.resolve();
  const result = earlier.then(write, write);
  const settled = result.then(
    () => undefined,
    () => undefined,
  );
  lastWrite.set(queryClient, settled);
  return result;
}

/**
 * Marks stale everything an accepted suggestion write can change: the accepted suggestions, and the
 * week and the heat rows the projection is worked out from together with them. The plan is not touched.
 */
export function refreshAcceptedSuggestions(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.acceptedSuggestionsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.weekSessionsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.setsAll });
}
