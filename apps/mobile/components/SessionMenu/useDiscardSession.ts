import { keys, useDeleteSession } from "@keylow/api-client";
import { TRAIN_DISCARD_FAILED } from "@keylow/core/copy";
import { onlineManager, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../ui";

type DiscardSession = {
  /**
   * Deletes the session, then calls `onDiscarded`. Offline, or on a failure, it shows the error toast and
   * keeps the session.
   */
  discard: () => Promise<void>;
  isDiscarding: boolean;
};

/**
 * Discards a session for good: the session and its sets are deleted together, with no Undo. A discard that
 * fails changes nothing, so the session stays and a danger toast states the rule. Offline it fails before it
 * asks: a discard is never held back to run when the phone is back online. The wait is on the
 * promise, not on the mutation's own callbacks, because the screen unmounts the moment the session is gone.
 */
export function useDiscardSession(sessionId: string, onDiscarded: () => void): DiscardSession {
  const toast = useToast();
  const deleteSession = useDeleteSession();
  const queryClient = useQueryClient();

  return {
    discard: async () => {
      if (!onlineManager.isOnline()) {
        toast.show({ message: TRAIN_DISCARD_FAILED, tone: "danger", icon: "CircleAlert" });
        return;
      }
      try {
        await deleteSession.mutateAsync(sessionId);
      } catch {
        toast.show({ message: TRAIN_DISCARD_FAILED, tone: "danger", icon: "CircleAlert" });
        return;
      }
      // The exercises added to the session with no set logged go with it.
      queryClient.removeQueries({ queryKey: keys.training.addedExercises(sessionId) });
      onDiscarded();
    },
    isDiscarding: deleteSession.isPending,
  };
}
