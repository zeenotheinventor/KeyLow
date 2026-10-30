import { SET_ENTRY } from "@keylow/core/copy";
import { setDraftOfValues } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { isPendingSetId } from "./pendingSets";
import { useAddSet } from "./useAddSet";
import { useRemoveSetWithUndo } from "./useRemoveSetWithUndo";

import type {
  LogSetRequest,
  PendingSets,
  RemoveSetRequest,
  ScreenSet,
  SessionView,
  SetLogging,
} from "./sessionViewTypes";
import type { SetNotices } from "./useRemoveSetWithUndo";

/**
 * What the checks of a session screen do. Logging turns the row done at once, as a set being saved, and
 * takes it back if the write fails, and a second press of the same row while the first is on its way does
 * nothing. Removing a set is `useRemoveSetWithUndo`'s. Every write needs a connection: with none, nothing
 * is written and nothing is kept for later. A failure says the set did not save, and never what its numbers
 * were. `notices` is how the app tells the person, so the words are the screen's to draw.
 */
export function useSetLogging(
  view: SessionView,
  pending: PendingSets,
  notices: SetNotices,
): SetLogging {
  const addSet = useAddSet();
  const logging = useRef(new Set<string>());
  const pendingCount = useRef(0);
  const { prune } = pending;
  const sets = view.status === "ready" ? view.sets : null;

  // A pending set is hidden as soon as the read holds the stored one, and dropped here.
  useEffect(() => {
    if (sets !== null) {
      prune(new Set(sets.map(({ id }) => id)));
    }
  }, [sets, prune]);

  const logSet = ({ exerciseId, values }: LogSetRequest) => {
    if (view.status !== "ready") {
      return;
    }
    const key = JSON.stringify({ exerciseId, values });
    if (logging.current.has(key)) {
      return;
    }
    if (!onlineManager.isOnline()) {
      notices.onFailure(SET_ENTRY.saveFailed);
      return;
    }
    logging.current.add(key);
    pendingCount.current += 1;
    const pendingId = `pending-${pendingCount.current}`;
    const now = new Date();
    pending.add({
      id: pendingId,
      session_id: view.sessionId,
      exercise_id: exerciseId,
      position: Math.max(-1, ...view.sets.map((set) => set.position)) + 1,
      set_type: values.setType,
      reps: values.reps,
      load_kg: values.loadKg,
      rir: values.rir,
      rpe: values.rpe,
      performed_at: now.toISOString(),
      deleted_at: null,
    } satisfies ScreenSet);
    void addSet
      .mutateAsync({
        sessionId: view.sessionId,
        exerciseId,
        draft: setDraftOfValues(values, view.unit),
        unit: view.unit,
        effortMode: "rir",
        now,
      })
      .then((stored) => {
        pending.markSaved(pendingId, stored.id);
      })
      .catch(() => {
        pending.drop(pendingId);
        notices.onFailure(SET_ENTRY.saveFailed);
      })
      .finally(() => {
        logging.current.delete(key);
      });
  };

  const removeSetWithUndo = useRemoveSetWithUndo(notices);
  const removeSet = (request: RemoveSetRequest) => {
    void removeSetWithUndo(request);
  };

  return { logSet, removeSet, isSaving: isPendingSetId };
}
