import { useDiscardSession as useSharedDiscardSession } from "@keylow/api-client";
import { TRAIN_DISCARD_FAILED } from "@keylow/core/copy";

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
 * Discards a session for good: the session and its sets are deleted together, with no Undo. The rules are
 * `@keylow/api-client`'s, shared with the web. The toast that states the rule on a failure is the phone's.
 */
export function useDiscardSession(sessionId: string, onDiscarded: () => void): DiscardSession {
  const toast = useToast();

  return useSharedDiscardSession(sessionId, {
    onDiscarded,
    onFailure: () => {
      toast.show({ message: TRAIN_DISCARD_FAILED, tone: "danger", icon: "CircleAlert" });
    },
  });
}
