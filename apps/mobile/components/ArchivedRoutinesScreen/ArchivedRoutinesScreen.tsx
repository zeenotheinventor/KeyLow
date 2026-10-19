import { useRoutines } from "@keylow/api-client";
import { useRouter } from "expo-router";

import { routinesPath } from "../../lib/routineRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ArchivedRoutinesView } from "../ArchivedRoutinesView";

/**
 * The archived routines, read from the list's one request, which brings them with the live routines. It is
 * normally opened from the list, so they are already in memory. Back returns to the list. Nothing restores a
 * routine yet, so Restore is not drawn.
 */
export function ArchivedRoutinesScreen() {
  const router = useRouter();
  const routines = useRoutines({ archived: true, enabled: useReadsEnabled() });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the routines instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(routinesPath());
    }
  }

  if (routines.data !== undefined) {
    return (
      <ArchivedRoutinesView
        routines={routines.data
          .filter((routine) => routine.is_archived)
          .map((routine) => ({
            id: routine.id,
            name: routine.name,
            dayCount: routine.summary.dayCount,
          }))}
        status="ready"
        onBack={goBack}
      />
    );
  }

  if (routines.isError) {
    return (
      <ArchivedRoutinesView
        status="error"
        onBack={goBack}
        onRetry={() => {
          void routines.refetch();
        }}
      />
    );
  }

  return <ArchivedRoutinesView status="loading" onBack={goBack} />;
}
