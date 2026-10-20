import { useProfileTimeZone, useRoutines } from "@keylow/api-client";
import { describeMakeActiveDialog } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";

import { exerciseProgressPath } from "../../lib/progressRoutes";
import {
  archivedRoutinesPath,
  editRoutinePath,
  newRoutinePath,
  trainPath,
} from "../../lib/routineRoutes";
import { useNow } from "../../lib/useNow";
import { useOpenOnce } from "../../lib/useOpenOnce";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RoutinesView } from "../RoutinesView";
import { ConfirmDialog } from "../ui";
import { useMakeRoutineActive } from "./useMakeRoutineActive";
import { useRoutineProgress } from "./useRoutineProgress";

import type { RoutineItem, RoutineRef } from "../RoutinesView";

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
 * Make active on an other routine asks first, as the `routines · set-active` board draws it, with today in
 * the profile's zone: the routine plans from that day. Until the zone is known the question cannot name
 * the day, so Make active is not drawn. A routine's card or row opens its editor, and New routine and
 * Create routine open the editor for a new one. The active routine's progress follows the list, and an
 * exercise of it opens its graph.
 */
export function RoutinesScreen() {
  const router = useRouter();
  const enabled = useReadsEnabled();
  const routines = useRoutines({ archived: true, enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const now = useNow();
  const makeActive = useMakeRoutineActive();
  // Only the active routine's progress is read: another routine opens its editor, which has no progress to show.
  const progress = useRoutineProgress(
    routines.data?.find((routine) => !routine.is_archived && routine.is_active)?.id,
  );
  // A second tap while an editor is sliding in would stack it twice.
  const openOnce = useOpenOnce();

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
      openOnce(() => {
        router.push(archivedRoutinesPath());
      });
    },
    onCreateRoutine: () => {
      openOnce(() => {
        router.push(newRoutinePath());
      });
    },
    onOpenExercise: (exerciseId: string) => {
      openOnce(() => {
        router.push(exerciseProgressPath(exerciseId));
      });
    },
    onEditRoutine: ({ id }: RoutineRef) => {
      openOnce(() => {
        router.push(editRoutinePath(id));
      });
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
  const localDate = zone === null ? null : toLocalDate(now, zone);
  return (
    <>
      <RoutinesView
        {...navigation}
        onMakeActive={
          localDate === null
            ? undefined
            : (routine) => {
                makeActive.ask(
                  routine,
                  describeMakeActiveDialog({
                    routineName: routine.name,
                    previousActiveName: active?.name ?? null,
                    localDate,
                  }),
                );
              }
        }
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
        progress={progress}
        others={live.filter((routine) => routine !== active).map(routineItemOf)}
        status="ready"
      />
      {makeActive.question === null ? null : (
        <ConfirmDialog
          body={makeActive.question.copy.body}
          busy={makeActive.isBusy}
          cancelLabel={makeActive.question.copy.cancelAction}
          confirmLabel={makeActive.question.copy.confirmAction}
          open={makeActive.isOpen}
          title={makeActive.question.copy.title}
          tone="primary"
          onCancel={makeActive.cancel}
          onConfirm={() => {
            void makeActive.confirm();
          }}
        />
      )}
    </>
  );
}
