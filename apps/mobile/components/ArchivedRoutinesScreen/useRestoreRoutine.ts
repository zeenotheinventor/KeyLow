import { useRestoreRoutine as useRestoreRoutineWrite } from "@keylow/api-client";

import { useToast } from "../ui";

import type { RoutineRef } from "../RoutinesView";

/**
 * Brings an archived routine back into the list, from the api-client, with the phone's toast for the one
 * error toast that says it did not go through.
 */
export function useRestoreRoutine(): (routine: RoutineRef) => Promise<void> {
  const toast = useToast();
  const restore = useRestoreRoutineWrite({
    showFailure: (message) => {
      toast.show({ message, tone: "danger", icon: "CircleAlert" });
    },
  });

  return async ({ id }) => {
    await restore(id);
  };
}
