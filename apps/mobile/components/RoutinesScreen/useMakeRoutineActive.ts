import { useMakeRoutineActive as useMakeRoutineActiveQuestion } from "@keylow/api-client";

import { useToast } from "../ui";

import type { RoutineRef } from "../RoutinesView";

/**
 * The make active question and its answer, from the api-client, with the phone's toast for the one error
 * toast that says the routine was not made active.
 */
export function useMakeRoutineActive() {
  const toast = useToast();

  return useMakeRoutineActiveQuestion<RoutineRef>({
    showFailure: (message) => {
      toast.show({ message, tone: "danger", icon: "CircleAlert" });
    },
  });
}
