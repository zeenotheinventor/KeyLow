import { useMemo } from "react";

import { describeSessionDetail } from "./describeSessionDetail";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSession } from "./useSession";
import { useWeightUnit } from "./useWeightUnit";

import type { SessionDetailView } from "./sessionDetailTypes";

/** What the session detail is told by the screen that uses it: the connection, and whether its reads may run. */
export type SessionDetailSettings = {
  /** Whether the device is online. Offline with nothing saved is an error without a Try again. */
  isOnline: boolean;
  /** False makes no request at all: the mobile app passes false while the terms gate is up. */
  enabled: boolean;
};

/**
 * What the session detail shows, from the reads it waits on: the session and the profile's unit and zone.
 * The mobile cache keeps the session, so one that was opened before opens offline there. Every read waits for
 * `enabled`, which is the terms gate. It reads no routine and compares nothing with one, so it never waits on
 * a routine and opens whatever became of the routine the session followed.
 *
 * A session that does not exist, is deleted or is another person's reads as null, and an id that is not a
 * UUID fails at once: both are not found, not an error, and neither is asked again. Anything else that fails
 * with nothing saved is an error, and offline with nothing saved is the same error without a Try again, which
 * would only join the wait.
 */
export function useSessionDetail(
  id: string | undefined,
  { isOnline, enabled }: SessionDetailSettings,
): SessionDetailView {
  const session = useSession(id, { enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const unit = useWeightUnit({ enabled });

  const loaded = session.data;
  const unitData = unit.data;
  const zone = timeZone.data === undefined ? undefined : (timeZone.data ?? "UTC");
  const content = useMemo(
    () =>
      loaded === undefined || loaded === null || unitData === undefined || zone === undefined
        ? null
        : describeSessionDetail(loaded, unitData, zone),
    [loaded, unitData, zone],
  );

  if (id === undefined || session.data === null || session.error instanceof RangeError) {
    return { status: "notFound" };
  }

  if (content !== null) {
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
