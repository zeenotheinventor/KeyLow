import { useDeleteEntry, useRestoreEntry } from "@keylow/api-client";
import { ENTRY_DELETED_TOAST, GENERIC_ERROR, UNDO_LABEL } from "@keylow/core/copy";
import { Trash2 } from "lucide-react";

import type { LogEntry } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

export type DeleteWithUndoOptions = {
  /**
   * The diary control the person pressed to get here, when the press was inside a dialog: the row's Edit
   * button or the stacked row. The keyboard route goes back to the control beside that row.
   */
  from?: Element | null | undefined;
};

/**
 * Deletes an entry at once and offers Undo, which puts the same entry back: the one handler for the diary's
 * Delete button and the edit dialog's. The row goes without waiting, and "Entry deleted" with its Undo waits
 * for the save, so a delete that fails shows the failure alone, and no Undo for an entry that was never
 * deleted. A failure of either request says so in a toast, and it is caught on the promise and not in a
 * per-call callback, because a callback never fires once the component that made the call (the edit dialog)
 * has unmounted. After a keyboard press the toast takes focus on Undo when it appears, and gives it back
 * beside the row (KEY-218).
 */
export function useDeleteEntryWithUndo(): (
  entry: LogEntry,
  options?: DeleteWithUndoOptions,
) => void {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const deleteEntry = useDeleteEntry();
  const restoreEntry = useRestoreEntry();

  function showFailure() {
    toast.show({ message: GENERIC_ERROR, tone: "danger" });
  }

  return (entry, { from } = {}) => {
    // Asked before the row goes, while focus is still on its button.
    const keyboardRoute = keyboardUndo.afterRemovingRow({ from });
    deleteEntry.mutateAsync(entry).then(() => {
      toast.show({
        message: ENTRY_DELETED_TOAST,
        icon: Trash2,
        actionLabel: UNDO_LABEL,
        onAction: () => {
          restoreEntry.mutateAsync(entry).catch(showFailure);
        },
        ...keyboardRoute,
      });
    }, showFailure);
  };
}
