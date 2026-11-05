import { ROUTINE_RESTORE_FAILED } from "@keylow/core/copy";
import { useRef } from "react";

import { useArchiveRoutine } from "./useArchiveRoutine";
import { writeWhenOnline } from "./writeWhenOnline";

import type { RoutineNotices } from "./routineNotices";

/**
 * Brings an archived routine back into the list. A press on a routine whose restore is on its way is
 * ignored, even one in the same moment, so a failure says so once. It resolves to whether the routine was restored. Offline, or on a failure, the routine
 * stays archived and the error toast says it did not go through.
 */
export function useRestoreRoutine({
  showFailure,
}: Pick<RoutineNotices, "showFailure">): (routineId: string) => Promise<boolean> {
  const { mutateAsync: setArchived } = useArchiveRoutine();
  const restoring = useRef(new Set<string>());

  return async (routineId) => {
    if (restoring.current.has(routineId)) {
      return false;
    }
    restoring.current.add(routineId);
    // Set inside the write, which runs later, so it is a property and not a variable the compiler narrows.
    const outcome = { isRestored: false };
    try {
      await writeWhenOnline(
        async () => {
          await setArchived({ id: routineId, archived: false });
          outcome.isRestored = true;
        },
        () => {
          showFailure(ROUTINE_RESTORE_FAILED);
        },
      );
    } finally {
      restoring.current.delete(routineId);
    }
    return outcome.isRestored;
  };
}
