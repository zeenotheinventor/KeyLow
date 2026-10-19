import { keys, useFinishSession } from "@keylow/api-client";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";

import type { SavedOutcome } from "./types";

type SaveSessionInput = {
  sessionId: string;
  /** Fixed when the screen opened, so a press that comes later is the same save. */
  endedAt: Date;
  onSaved: (outcome: SavedOutcome) => void;
};

/**
 * Saves the session once. A press while a save is on its way does nothing, even one that comes before the
 * screen has drawn the first (the guard is a ref, not the mutation's state). A blank note is stored as
 * null. A failure leaves the screen as it was, with `hasFailed` set, and the next press sends again.
 * Nothing is queued: the write needs a connection, so with none the press goes straight to the failure
 * and sends nothing, rather than wait on the read the write starts with. Success calls `onSaved`, which
 * is the route's to answer with the toast, since the toast must outlive this screen. The Android back key
 * does nothing while a save is on its way. If the screen has closed anyway, `onSaved` still comes, with
 * `isScreenOpen` false, so the toast shows and the route does not leave a second time.
 */
export function useSaveSession({ sessionId, endedAt, onSaved }: SaveSessionInput) {
  const finish = useFinishSession();
  const queryClient = useQueryClient();
  const [isOfflineFailure, setIsOfflineFailure] = useState(false);
  const isSaving = useRef(false);
  const isScreenOpen = useRef(true);

  useEffect(() => {
    isScreenOpen.current = true;
    return () => {
      isScreenOpen.current = false;
    };
  }, []);

  const isPending = finish.isPending;
  useEffect(() => {
    if (!isPending) {
      return;
    }
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => {
      subscription.remove();
    };
  }, [isPending]);

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
      await finish.mutateAsync({ id: sessionId, endedAt, note: note.trim() === "" ? null : note });
    } catch {
      // The failure is read from the mutation's state, and the next press is allowed to send again.
      isSaving.current = false;
      return;
    }
    // The exercises added to the session with no set logged were never saved, and the session is over.
    queryClient.removeQueries({ queryKey: keys.training.addedExercises(sessionId) });
    onSaved({ isScreenOpen: isScreenOpen.current });
  }

  return { save, isSaving: finish.isPending, hasFailed: finish.isError || isOfflineFailure };
}
