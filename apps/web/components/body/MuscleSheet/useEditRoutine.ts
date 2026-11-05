import { useActiveRoutine } from "@keylow/api-client";
import { useRouter } from "next/navigation";

import { trainRoutineEditPath, trainRoutineNewPath } from "@/lib/trainRoutes";

/**
 * What the sheet's Edit routine button does: it closes the sheet and opens the active routine's editor, or
 * the create page when there is none. The button waits for the routine read, so a routine that exists is
 * never mistaken for none, and offline with nothing read there is no button at all. The sheet closes
 * before the page changes, so Back returns to the screen with the sheet shut.
 */
export function useEditRoutine(closeSheet: () => void): (() => void) | undefined {
  const router = useRouter();
  const routine = useActiveRoutine();

  if (routine.data === undefined) {
    return undefined;
  }
  const editorPath =
    routine.data === null ? trainRoutineNewPath() : trainRoutineEditPath(routine.data.id);

  return () => {
    closeSheet();
    router.push(editorPath);
  };
}
