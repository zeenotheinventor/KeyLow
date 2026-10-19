import { useArchiveRoutine } from "@keylow/api-client";
import { ROUTINE_RESTORE_FAILED } from "@keylow/core/copy";
import { useRef } from "react";

import { writeWhenOnline } from "../../lib/writeWhenOnline";
import { useToast } from "../ui";

import type { RoutineRef } from "../RoutinesView";

/**
 * Brings an archived routine back into the list. A press on a routine whose restore is on its way is
 * ignored, even one in the same moment, so a failure says so once. Offline, or on a failure, the routine
 * stays archived and the error toast says it did not go through.
 */
export function useRestoreRoutine(): (routine: RoutineRef) => Promise<void> {
  const toast = useToast();
  const archive = useArchiveRoutine();
  const restoring = useRef(new Set<string>());

  return async ({ id }) => {
    if (restoring.current.has(id)) {
      return;
    }
    restoring.current.add(id);
    try {
      await writeWhenOnline(
        () => archive.mutateAsync({ id, archived: false }),
        () => {
          toast.show({ message: ROUTINE_RESTORE_FAILED, tone: "danger", icon: "CircleAlert" });
        },
      );
    } finally {
      restoring.current.delete(id);
    }
  };
}
