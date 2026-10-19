import {
  useActiveRoutine,
  useProfileTimeZone,
  useSession,
  useWeightUnit,
} from "@keylow/api-client";
import { useMemo } from "react";

import { describeSessionDetail } from "./describeSessionDetail";
import { useIsOnline } from "../../lib/connectivity";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { SessionDetailView } from "./types";

/**
 * What the session detail shows, from the reads it waits on: the session (kept on the phone, so one that was
 * opened before opens offline), the profile's unit and zone and, for a session that followed a routine day,
 * the active routine, whose day the sets are compared with. Every read waits until the account has accepted
 * the current Terms.
 *
 * A session that does not exist, is deleted or is another person's reads as null, and an id that is not a
 * UUID fails at once: both are not found, not an error, and neither is asked again. The routine does not hold
 * the screen up. A session whose day is no longer in the active routine, or whose routine cannot be read
 * (the phone is offline and has it not saved, or the read failed), is drawn with no plan to compare with.
 * Anything else that fails with nothing saved is an error, and offline with nothing saved is the same error
 * without a Try again, which would only join the wait.
 */
export function useSessionDetail(id: string | undefined): SessionDetailView {
  const enabled = useReadsEnabled();
  const isOnline = useIsOnline();
  const session = useSession(id, { enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const unit = useWeightUnit({ enabled });
  const routineDayId = session.data?.routine_day_id ?? null;
  const routine = useActiveRoutine({ enabled: enabled && routineDayId !== null });

  const loaded = session.data;
  const unitData = unit.data;
  const zone = timeZone.data === undefined ? undefined : (timeZone.data ?? "UTC");
  const plannedDay = useMemo(() => {
    const day = routine.data?.days.find((entry) => entry.id === routineDayId);
    return day === undefined ? undefined : { name: day.name, exercises: day.exercises };
  }, [routine.data, routineDayId]);
  const content = useMemo(
    () =>
      loaded === undefined || loaded === null || unitData === undefined || zone === undefined
        ? null
        : describeSessionDetail(loaded, plannedDay, unitData, zone),
    [loaded, plannedDay, unitData, zone],
  );

  if (id === undefined || session.data === null || session.error instanceof RangeError) {
    return { status: "notFound" };
  }

  // A routine read that is paused waits for a connection the phone does not have saved, and one that failed
  // will not come: the session is shown without its plan in both.
  const isWaitingForRoutine =
    routineDayId !== null &&
    routine.data === undefined &&
    routine.fetchStatus !== "paused" &&
    !routine.isError;
  if (content !== null && !isWaitingForRoutine) {
    return { status: "ready", content };
  }

  const reads = [session, timeZone, unit];
  const failed = reads.filter((read) => read.isError && read.data === undefined);
  if (failed.length > 0 || !isOnline) {
    return {
      status: "error",
      retry: isOnline
        ? () => {
            for (const read of failed) {
              void read.refetch();
            }
          }
        : undefined,
    };
  }
  return { status: "loading" };
}
