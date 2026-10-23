import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { toHistoryEntries } from "./historyEntries";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { useActiveRoutine } from "./useActiveRoutine";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listSessionsInWeek } from "../repos/trainingHistory";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { HistoryEntry } from "./historyEntries";
import type { TrainingReadResult } from "./trainingReadResult";
import type { HistorySessionRow } from "../repos/trainingSchemas";

/**
 * The live sessions of the week that starts on the Monday `weekStart` (`YYYY-MM-DD`) that hold a live
 * set, ended or not, newest first, each with its summary (core's `summariseSession`) and, when the active routine still holds the day it
 * was planned from, the comparison with that day. The week is Monday to Sunday by the local date of each
 * session.
 *
 * What is cached is rows: the sessions with their sets under `keys.training.history(weekStart)`, which
 * the mobile cache keeps so the list opens without a connection. The summaries run in `select`, over
 * those rows and the active routine (`useActiveRoutine`), so they are worked out at read time, online
 * or not. The result is pending until the routine has been read, so a summary never shows and then
 * gains its comparison. A routine that cannot be read is not an error here, and neither is one that
 * is not stored while offline (its read is paused): the sessions show with no comparison. `enabled` false makes no request at all. A date that is not a Monday fails without a
 * request, as an error that is not retried.
 */
export function useHistoryWeek(
  weekStart: string,
  { enabled = true }: DiaryReadOptions = {},
): TrainingReadResult<HistoryEntry[]> {
  const client = useSupabase();
  const routine = useActiveRoutine({ enabled });

  // A routine that is not stored and cannot be fetched (offline) is waited for no longer.
  const routineRead = !routine.isPending || routine.fetchStatus === "paused";
  const activeRoutine = routine.data;

  const select = useCallback(
    (sessions: HistorySessionRow[]) =>
      routineRead ? toHistoryEntries(sessions, activeRoutine) : undefined,
    [routineRead, activeRoutine],
  );

  const sessions = useQuery<HistorySessionRow[], Error, HistoryEntry[] | undefined>({
    queryKey: keys.training.history(weekStart),
    queryFn: () => listSessionsInWeek(client, weekStart),
    enabled,
    select,
    retry: retryUnlessRangeError,
  });

  return toTrainingReadResult(sessions, [], []);
}
