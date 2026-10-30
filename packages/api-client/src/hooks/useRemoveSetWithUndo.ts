import { FINISH_SCREEN, SET_ENTRY, describeSetRemovedToast } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { useRef } from "react";

import { useRemoveSet } from "./useRemoveSet";
import { useRestoreSet } from "./useRestoreSet";

import type { RemoveSetRequest } from "./sessionViewTypes";

/** What the app does with the words: a danger toast for a failure, and a toast with Undo for a removal. */
export type SetNotices = {
  /** A write failed. The sentence states the rule and never a value. */
  onFailure: (message: string) => void;
  /** The set was removed. Calling `undo` restores it. */
  onRemoved: (notice: { message: string; actionLabel: string; undo: () => void }) => void;
};

/** The rule a restore was refused by (a full session), which states no value. Any other failure is the generic sentence. */
const messageOf = (error: unknown): string =>
  error instanceof RangeError ? error.message : SET_ENTRY.saveFailed;

/**
 * Removes a logged set and offers the Undo, "Set removed: Romanian deadlift, set 3", which restores it.
 * Needs a connection: with none, nothing is written and nothing is kept for later, and a failure says the set
 * was not removed, never what its numbers were. A second press of the same set while the first is on its way
 * does nothing. Resolves to whether the set was removed.
 */
export function useRemoveSetWithUndo({
  onFailure,
  onRemoved,
}: SetNotices): (request: RemoveSetRequest) => Promise<boolean> {
  const removeSetMutation = useRemoveSet();
  const restoreSetMutation = useRestoreSet();
  const removing = useRef(new Set<string>());

  const restore = (setId: string) => {
    if (!onlineManager.isOnline()) {
      onFailure(SET_ENTRY.saveFailed);
      return;
    }
    restoreSetMutation.mutateAsync(setId).catch((error: unknown) => {
      onFailure(messageOf(error));
    });
  };

  return async ({ setId, exerciseName, setType, setNumber }) => {
    if (removing.current.has(setId)) {
      return false;
    }
    if (!onlineManager.isOnline()) {
      onFailure(SET_ENTRY.removeFailed);
      return false;
    }
    removing.current.add(setId);
    try {
      await removeSetMutation.mutateAsync(setId);
    } catch {
      onFailure(SET_ENTRY.removeFailed);
      return false;
    } finally {
      removing.current.delete(setId);
    }
    onRemoved({
      message: describeSetRemovedToast({ exerciseName, setType, setNumber }),
      actionLabel: FINISH_SCREEN.undoAction,
      undo: () => {
        restore(setId);
      },
    });
    return true;
  };
}
