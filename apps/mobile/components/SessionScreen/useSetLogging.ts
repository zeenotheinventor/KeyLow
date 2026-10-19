import { useAddSet } from "@keylow/api-client";
import { SET_ENTRY } from "@keylow/core/copy";
import { displayLoad } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useToast } from "../ui";
import { isPendingSetId } from "./pendingSets";
import { useRemoveSetWithUndo } from "./useRemoveSetWithUndo";

import type {
  LogSetRequest,
  PendingSets,
  RemoveSetRequest,
  ScreenSet,
  SessionScreenView,
  SetLogging,
} from "./types";
import type { LoadUnit, SetDraft, SetValues } from "@keylow/core/training";

/** The text a set's numbers are entered as, which is how the set writes take them. RIR is the only effort measure the screen logs. */
function draftOf(values: SetValues, unit: LoadUnit): SetDraft {
  return {
    setType: values.setType,
    load: values.loadKg === null ? "" : displayLoad(values.loadKg, unit),
    reps: String(values.reps),
    rir: values.rir === null ? "" : String(values.rir),
    rpe: "",
  };
}

/**
 * What the checks of the session screen do. Logging turns the row done at once, as a set being saved, and
 * takes it back if the write fails; a second press of the same row while the first is on its way does
 * nothing. Removing a set is `useRemoveSetWithUndo`'s. Every write needs a connection: with
 * none, nothing is written and nothing is kept for later. A failure says the set did not save, and never
 * what its numbers were.
 */
export function useSetLogging(view: SessionScreenView, pending: PendingSets): SetLogging {
  const toast = useToast();
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

  const showFailure = (message: string = SET_ENTRY.saveFailed) => {
    toast.show({ message, tone: "danger", icon: "CircleAlert" });
  };

  const logSet = ({ exerciseId, values }: LogSetRequest) => {
    if (view.status !== "ready") {
      return;
    }
    const key = JSON.stringify({ exerciseId, values });
    if (logging.current.has(key)) {
      return;
    }
    if (!onlineManager.isOnline()) {
      showFailure();
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
        draft: draftOf(values, view.unit),
        unit: view.unit,
        effortMode: "rir",
        now,
      })
      .then((stored) => {
        pending.markSaved(pendingId, stored.id);
      })
      .catch(() => {
        pending.drop(pendingId);
        showFailure();
      })
      .finally(() => {
        logging.current.delete(key);
      });
  };

  const removeSetWithUndo = useRemoveSetWithUndo();
  const removeSet = (request: RemoveSetRequest) => {
    void removeSetWithUndo(request);
  };

  return { logSet, removeSet, isSaving: isPendingSetId };
}
