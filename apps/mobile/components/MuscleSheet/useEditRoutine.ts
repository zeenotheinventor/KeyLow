import { useActiveRoutine } from "@keylow/api-client";
import { useRouter } from "expo-router";

import { editRoutinePath, newRoutinePath } from "../../lib/routineRoutes";
import { useOpenOnce } from "../../lib/useOpenOnce";

type EditRoutineInput = {
  /** False makes no read at all. */
  enabled: boolean;
  /** Closes the sheet the button is on. */
  closeSheet: () => void;
};

/**
 * What the sheet's Edit routine button does: it closes the sheet and opens the active routine's editor, or
 * the create flow when there is none. The button waits for the routine read, so a routine that exists is
 * never mistaken for none, and it opens the editor once however often it is pressed. Back returns to the
 * screen the sheet was on.
 */
export function useEditRoutine({
  enabled,
  closeSheet,
}: EditRoutineInput): (() => void) | undefined {
  const router = useRouter();
  const openOnce = useOpenOnce();
  const routine = useActiveRoutine({ enabled });

  if (routine.data === undefined) {
    return undefined;
  }
  const editorPath = routine.data === null ? newRoutinePath() : editRoutinePath(routine.data.id);

  return () => {
    openOnce(() => {
      closeSheet();
      router.push(editorPath);
    });
  };
}
