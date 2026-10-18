import { keys } from "./queryKeys";

import type { SessionWithSets } from "./repos/trainingSchemas";
import type { QueryClient } from "@tanstack/react-query";

/** Puts a stored session in the cache of its own screen, so the screen that opens it next has it at once. */
export function putSessionInCache(queryClient: QueryClient, session: SessionWithSets): void {
  queryClient.setQueryData(keys.training.session(session.id), session);
}

/** Puts a session in the cache as the one in progress, which the session bar and Resume read. */
export function putActiveSessionInCache(queryClient: QueryClient, session: SessionWithSets): void {
  queryClient.setQueryData(keys.training.activeSession, session);
}

/** Clears the session in progress from the cache when it is the session `id`. Another one is left as it is. */
export function clearActiveSessionInCache(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<SessionWithSets | null>(keys.training.activeSession, (cached) =>
    cached?.id === id ? null : cached,
  );
}

/**
 * Marks stale everything a session write can change: the sessions, the one in progress, and the sets
 * and the week sessions that heat, the week and the body map are worked out from. The plan and the
 * routines are not touched.
 */
export function refreshSessions(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.sessionsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.activeSession });
  void queryClient.invalidateQueries({ queryKey: keys.training.setsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.weekSessionsAll });
}
