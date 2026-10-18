import { orderSessionSets } from "@keylow/core/training";

import { keys } from "./queryKeys";

import type { SessionSet, SessionWithSets } from "./repos/trainingSchemas";
import type { QueryClient } from "@tanstack/react-query";

/**
 * The mutation scope of the set writes that change a set that is already logged: update, remove,
 * restore and reorder. Mutations of one scope run one after another, so an Undo tapped while the
 * remove is still on its way waits for it, and the last edit wins. It is one scope and not one per
 * session, because a scope is fixed when the hook is made and a person logs one session at a time.
 * Logging a set is not in it: a double press is joined by `useSingleFlight`, which a queue would defeat.
 */
export const SESSION_SET_SCOPE = { id: "session-sets" } as const;

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

const withSet = (session: SessionWithSets, set: SessionSet): SessionWithSets => ({
  ...session,
  sets: orderSessionSets([...session.sets.filter(({ id }) => id !== set.id), set]),
});

/**
 * Puts a set as the database stored it in the cached session it belongs to, and in the session in
 * progress when that is the same session, in list order. A removed set comes out, since the list holds
 * live sets only. A session that is not cached stays uncached.
 */
export function putSetInSessionCaches(queryClient: QueryClient, set: SessionSet): void {
  queryClient.setQueryData<SessionWithSets | null>(
    keys.training.session(set.session_id),
    (cached) => (cached ? withSet(cached, set) : cached),
  );
  queryClient.setQueryData<SessionWithSets | null>(keys.training.activeSession, (cached) =>
    cached?.id === set.session_id ? withSet(cached, set) : cached,
  );
}

/**
 * Marks stale everything a session write can change: the sessions, the one in progress, the sets, the
 * week sessions and the history that heat, the week and the body map are worked out from, and the "previous"
 * values of every exercise, which a logged, changed or removed set moves. The plan and the routines
 * are not touched.
 */
export function refreshSessions(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: keys.training.sessionsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.activeSession });
  void queryClient.invalidateQueries({ queryKey: keys.training.setsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.weekSessionsAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.historyAll });
  void queryClient.invalidateQueries({ queryKey: keys.training.lastPerformanceAll });
}
