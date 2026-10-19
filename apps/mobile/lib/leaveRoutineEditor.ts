import { routinesPath } from "./routineRoutes";

import type { useRouter } from "expo-router";

/** Goes back from the routine editor. A cold link to it has nothing before it, so it goes to the routines list instead. */
export function leaveRoutineEditor(router: ReturnType<typeof useRouter>): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(routinesPath());
  }
}

/**
 * Leaves the editor after a save for the routines list, which shows the routine. The list is under the
 * editor when it was opened from the list, and is popped back to. Opened from the Train home's Create routine
 * it is not, and the list takes the editor's place.
 */
export function leaveRoutineEditorSaved(router: ReturnType<typeof useRouter>): void {
  router.dismissTo(routinesPath());
}
