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
