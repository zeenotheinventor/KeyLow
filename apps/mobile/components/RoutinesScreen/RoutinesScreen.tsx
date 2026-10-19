import { useProfileTimeZone, useRoutines } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";

import { archivedRoutinesPath, trainPath } from "../../lib/routineRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RoutinesView } from "../RoutinesView";

import type { RoutineItem } from "../RoutinesView";

type StoredRoutine = NonNullable<ReturnType<typeof useRoutines>["data"]>[number];

const routineItemOf = (routine: StoredRoutine): RoutineItem => ({
  id: routine.id,
  name: routine.name,
  days: routine.days.map(({ name, weekday }) => ({ name, weekday })),
  setsPerWeek: routine.summary.setsPerWeek,
});

/**
 * The routines list, read from the library's one request, which brings the archived routines with the live
 * ones, so the archived list opened from here already has them. The date the active routine began is in the
 * profile's time zone, and a profile without one is UTC. The list does not wait for the zone: until it is
 * known the date is left out. Both reads are kept on the phone, so the list opens
 * without a connection. Back returns to the Train tab, and the archived link opens the archived routines.
 * Nothing makes a routine active, edits or creates one yet, so those controls are not drawn.
 */
export function RoutinesScreen() {
  const router = useRouter();
  const enabled = useReadsEnabled();
  const routines = useRoutines({ archived: true, enabled });
  const timeZone = useProfileTimeZone({ enabled });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Train tab instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(trainPath());
    }
  }

  const navigation = {
    onBack: goBack,
    onOpenArchived: () => {
      router.push(archivedRoutinesPath());
    },
  };

  if (routines.data === undefined) {
    if (routines.isError) {
      return (
        <RoutinesView
          {...navigation}
          status="error"
          onRetry={() => {
            void routines.refetch();
          }}
        />
      );
    }
    return <RoutinesView {...navigation} status="loading" />;
  }

  // The list does not wait for the zone, or fail with it: a zone that is not known (still loading, or it
  // failed) leaves the date out, and a profile without one is UTC. The date is never guessed.
  const zone = timeZone.data === undefined ? null : (timeZone.data ?? "UTC");
  const live = routines.data.filter((routine) => !routine.is_archived);
  const active = live.find((routine) => routine.is_active);

  return (
    <RoutinesView
      {...navigation}
      active={
        active === undefined
          ? null
          : {
              ...routineItemOf(active),
              activeFrom:
                active.activated_at === null || zone === null
                  ? null
                  : toLocalDate(new Date(active.activated_at), zone),
            }
      }
      archivedCount={routines.data.length - live.length}
      others={live.filter((routine) => routine !== active).map(routineItemOf)}
      status="ready"
    />
  );
}
