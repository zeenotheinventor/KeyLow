import { useRemoveSet, useRestoreSet } from "@keylow/api-client";
import { FINISH_SCREEN, SET_ENTRY, describeSetRemovedToast } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { useRef } from "react";

import { useToast } from "../ui";

import type { RemoveSetRequest } from "./types";

/** The rule a restore was refused by (a full session), which states no value; any other failure is the generic sentence. */
const messageOf = (error: unknown): string =>
  error instanceof RangeError ? error.message : SET_ENTRY.saveFailed;

/**
 * Removes a logged set and offers the Undo toast, "Set removed: Romanian deadlift, set 3", which restores it.
 * Needs a connection: with none, nothing is written and nothing is kept for later, and a failure says the set
 * was not removed, never what its numbers were. A second press of the same set while the first is on its way
 * does nothing. Resolves to whether the set was removed.
 */
export function useRemoveSetWithUndo(): (request: RemoveSetRequest) => Promise<boolean> {
  const toast = useToast();
  const removeSetMutation = useRemoveSet();
  const restoreSetMutation = useRestoreSet();
  const removing = useRef(new Set<string>());

  const showFailure = (message: string) => {
    toast.show({ message, tone: "danger", icon: "CircleAlert" });
  };

  const restore = (setId: string) => {
    if (!onlineManager.isOnline()) {
      showFailure(SET_ENTRY.saveFailed);
      return;
    }
    restoreSetMutation.mutateAsync(setId).catch((error: unknown) => {
      showFailure(messageOf(error));
    });
  };

  return async ({ setId, exerciseName, setType, setNumber }) => {
    if (removing.current.has(setId)) {
      return false;
    }
    if (!onlineManager.isOnline()) {
      showFailure(SET_ENTRY.removeFailed);
      return false;
    }
    removing.current.add(setId);
    try {
      await removeSetMutation.mutateAsync(setId);
    } catch {
      showFailure(SET_ENTRY.removeFailed);
      return false;
    } finally {
      removing.current.delete(setId);
    }
    toast.show({
      message: describeSetRemovedToast({ exerciseName, setType, setNumber }),
      actionLabel: FINISH_SCREEN.undoAction,
      onAction: () => {
        restore(setId);
      },
    });
    return true;
  };
}
