import { onlineManager, useQueryClient } from "@tanstack/react-query";

import { keys } from "../queryKeys";
import { useDeleteSession } from "./useDeleteSession";

type DiscardNotices = {
  /** The session is gone. The app goes on to its next screen. */
  onDiscarded: () => void;
  /** The discard did not happen and the session stays. The app says so. */
  onFailure: () => void;
};

/**
 * Discards a session for good: the session and its sets are deleted together, with no Undo. A discard that
 * fails changes nothing, so the session stays and the app is told. Offline it fails before it asks: a discard
 * is never held back to run when the device is back online. The wait is on the promise, not on the
 * mutation's own callbacks, because the screen unmounts the moment the session is gone.
 */
export function useDiscardSession(sessionId: string, { onDiscarded, onFailure }: DiscardNotices) {
  const deleteSession = useDeleteSession();
  const queryClient = useQueryClient();

  return {
    discard: async (): Promise<void> => {
      if (!onlineManager.isOnline()) {
        onFailure();
        return;
      }
      try {
        await deleteSession.mutateAsync(sessionId);
      } catch {
        onFailure();
        return;
      }
      // The exercises added to the session with no set logged go with it.
      queryClient.removeQueries({ queryKey: keys.training.addedExercises(sessionId) });
      onDiscarded();
    },
    isDiscarding: deleteSession.isPending,
  };
}
