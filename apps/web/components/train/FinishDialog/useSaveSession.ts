import { keys, useFinishSession } from "@keylow/api-client";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

type SaveSessionInput = {
  sessionId: string;
  /** Fixed when the dialog opened, so a press that comes later is the same save. */
  endedAt: Date;
  onSaved: () => void;
};

/**
 * Saves the session once. A press while a save is on its way does nothing, even one that comes before the
 * dialog has drawn the first (the guard is a ref, not the mutation's state). A blank note is stored as null
 * by `finishSession`. A failure leaves the dialog as it was, with `hasFailed` set, and the next press sends again. Nothing is
 * queued: the write needs a connection, so with none the press goes straight to the failure and sends
 * nothing. Success calls `onSaved`, even if the page has been left since the press, so the toast shows.
 */
export function useSaveSession({ sessionId, endedAt, onSaved }: SaveSessionInput) {
  const finish = useFinishSession();
  const queryClient = useQueryClient();
  const [isOfflineFailure, setIsOfflineFailure] = useState(false);
  const isSaving = useRef(false);

  async function save(note: string) {
    if (isSaving.current) {
      return;
    }
    if (!onlineManager.isOnline()) {
      setIsOfflineFailure(true);
      return;
    }
    setIsOfflineFailure(false);
    isSaving.current = true;
    try {
      await finish.mutateAsync({ id: sessionId, endedAt, note });
    } catch {
      // The failure is read from the mutation's state, and the next press is allowed to send again.
      isSaving.current = false;
      return;
    }
    // The exercises added to the session with no set logged were never saved, and the session is over.
    queryClient.removeQueries({ queryKey: keys.training.addedExercises(sessionId) });
    onSaved();
  }

  return { save, isSaving: finish.isPending, hasFailed: finish.isError || isOfflineFailure };
}
