import { useActiveRoutine, useHasLoggedSession, useProfileTimeZone } from "@keylow/api-client";

import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { TrainHome } from "./types";

/**
 * What the Train home shows, from the reads it waits on: the profile's time zone, the active routine and,
 * only when there is no routine, whether any session was ever logged (a routine already says it is not a
 * first visit, so the read is not made). Every read waits until the account has accepted the current Terms.
 * It is ready once the reads it needs are there, from the cache too, so it works offline. A read that fails
 * while there is nothing to show is an error, and a refetch that fails behind content that is already there
 * is not. `retry` reads again the ones that are being used. The today card and the week strip join the
 * reads here.
 */
export function useTrainHome(): TrainHome {
  const enabled = useReadsEnabled();
  const timeZone = useProfileTimeZone({ enabled });
  const routine = useActiveRoutine({ enabled });
  const sessions = useHasLoggedSession({ enabled: enabled && routine.data === null });

  const needsSessions = routine.data === null;
  const reads = needsSessions ? [timeZone, routine, sessions] : [timeZone, routine];

  if (reads.some((read) => read.isError && read.data === undefined)) {
    return {
      status: "error",
      retry: () => {
        for (const read of reads) {
          void read.refetch();
        }
      },
    };
  }

  if (
    timeZone.data === undefined ||
    routine.data === undefined ||
    (needsSessions && sessions.data === undefined)
  ) {
    return { status: "loading" };
  }

  return {
    status: "ready",
    hasRoutine: routine.data !== null,
    hasLoggedSession: sessions.data === true,
    // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
    timeZone: timeZone.data ?? "UTC",
    savedAt: new Date(Math.min(...reads.map((read) => read.dataUpdatedAt))),
  };
}
