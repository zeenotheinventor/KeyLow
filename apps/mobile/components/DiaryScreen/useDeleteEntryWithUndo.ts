import { useDeleteEntry, useRestoreEntry } from "@keylow/api-client";
import { DIARY_UNDO_ACTION, ENTRY_DELETED_TOAST } from "@keylow/core/copy";

import { useToast } from "../ui";

import type { LogEntry } from "@keylow/api-client";

/**
 * Deletes an entry at once, with no confirmation, and says so in a toast with Undo (5 seconds). The row
 * leaves the log as the delete is asked for, and the toast waits for the save, so a delete that fails
 * brings the row back and says nothing. Undo restores exactly that entry, by its id.
 */
export function useDeleteEntryWithUndo(): (entry: LogEntry) => void {
  const toast = useToast();
  const deleteEntry = useDeleteEntry();
  const restoreEntry = useRestoreEntry();

  // `mutateAsync` is per call, where the callbacks of `mutate` run for the latest call only, so each delete
  // keeps its own toast and Undo when another follows before it is saved.
  return (entry) => {
    deleteEntry.mutateAsync(entry).then(
      () => {
        toast.show({
          message: ENTRY_DELETED_TOAST,
          icon: "Trash2",
          actionLabel: DIARY_UNDO_ACTION,
          onAction: () => {
            restoreEntry.mutate(entry);
          },
        });
      },
      // The hook has put the row back, and a delete that failed has nothing to say.
      () => undefined,
    );
  };
}
