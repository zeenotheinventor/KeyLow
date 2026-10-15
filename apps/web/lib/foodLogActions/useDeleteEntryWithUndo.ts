import { useDeleteEntry, useRestoreEntry } from "@keylow/api-client";
import { ENTRY_DELETED_TOAST, GENERIC_ERROR, UNDO_LABEL } from "@keylow/core/copy";
import { Trash2 } from "lucide-react";

import type { LogEntry } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";

/**
 * Deletes an entry at once and offers Undo, which puts the same entry back: the one handler for the diary's
 * Delete button and the edit dialog's. The row goes without waiting, and a failure of either request says
 * so in a toast.
 */
export function useDeleteEntryWithUndo(): (entry: LogEntry) => void {
  const toast = useToast();
  const deleteEntry = useDeleteEntry();
  const restoreEntry = useRestoreEntry();

  function showFailure() {
    toast.show({ message: GENERIC_ERROR, tone: "danger" });
  }

  return (entry) => {
    deleteEntry.mutate(entry, { onError: showFailure });
    toast.show({
      message: ENTRY_DELETED_TOAST,
      icon: Trash2,
      actionLabel: UNDO_LABEL,
      onAction: () => {
        restoreEntry.mutate(entry, { onError: showFailure });
      },
    });
  };
}
