import { useArchiveRoutineWithUndo as useArchiveRoutineWithUndoWrite } from "@keylow/api-client";

import { useToast } from "../ui";

/**
 * Archives a routine from its editor and offers Undo, from the api-client, with the phone's toast. The
 * toast is the provider's and stays after the editor is gone.
 */
export function useArchiveRoutineWithUndo(): (routineId: string) => Promise<boolean> {
  const toast = useToast();

  return useArchiveRoutineWithUndoWrite({
    showFailure: (message) => {
      toast.show({ message, tone: "danger", icon: "CircleAlert" });
    },
    showArchived: ({ message, actionLabel, onAction }) => {
      toast.show({ message, actionLabel, onAction });
    },
  });
}
