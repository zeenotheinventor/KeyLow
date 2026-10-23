import { RoutineRuleError, useArchiveRoutine } from "@keylow/api-client";
import {
  ARCHIVE_ACTIVE_REFUSAL,
  ROUTINE_ARCHIVE_FAILED,
  ROUTINE_ARCHIVED_TOAST,
  ROUTINE_RESTORE_FAILED,
} from "@keylow/core/copy";
import { useRef } from "react";

import { writeWhenOnline } from "../../lib/writeWhenOnline";
import { useToast } from "../ui";

/**
 * Archives a routine from its editor and offers Undo. It resolves to whether the routine was archived, and
 * says so itself: a toast with Undo when it was, and one danger toast when it was not. Offline, or on a
 * failed write, the routine stays as it was. A routine that became active elsewhere is refused by the
 * database, which is told as the refusal and not as a failure. A press while one is on its way is ignored.
 *
 * The toast is the provider's and stays after the editor is gone, so Undo holds only the toast, the
 * archive write and the id, and never reads the editor's state. A failed Undo says the routine was not restored.
 * Neither a routine's name nor the error is ever passed on: a routine's name is health data.
 */
export function useArchiveRoutineWithUndo(): (routineId: string) => Promise<boolean> {
  const toast = useToast();
  const { mutateAsync: setArchived } = useArchiveRoutine();
  const isArchiving = useRef(false);

  function showDanger(message: string) {
    toast.show({ message, tone: "danger", icon: "CircleAlert" });
  }

  function undo(routineId: string) {
    void writeWhenOnline(
      () => setArchived({ id: routineId, archived: false }),
      () => {
        showDanger(ROUTINE_RESTORE_FAILED);
      },
    );
  }

  return async (routineId) => {
    if (isArchiving.current) {
      return false;
    }
    isArchiving.current = true;
    // Set inside the write, which runs later, so it is a property and not a variable the compiler narrows.
    const outcome = { isArchived: false };
    try {
      await writeWhenOnline(
        async () => {
          try {
            await setArchived({ id: routineId, archived: true });
          } catch (error) {
            if (error instanceof RoutineRuleError) {
              showDanger(ARCHIVE_ACTIVE_REFUSAL);
              return;
            }
            throw error;
          }
          outcome.isArchived = true;
        },
        () => {
          showDanger(ROUTINE_ARCHIVE_FAILED);
        },
      );
    } finally {
      isArchiving.current = false;
    }
    if (outcome.isArchived) {
      toast.show({
        message: ROUTINE_ARCHIVED_TOAST.message,
        actionLabel: ROUTINE_ARCHIVED_TOAST.undoAction,
        onAction: () => {
          undo(routineId);
        },
      });
    }
    return outcome.isArchived;
  };
}
