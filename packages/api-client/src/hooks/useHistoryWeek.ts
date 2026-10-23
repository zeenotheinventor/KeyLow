import { useQuery } from "@tanstack/react-query";

import { toHistoryEntries } from "./historyEntries";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listSessionsInWeek } from "../repos/trainingHistory";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { HistoryEntry } from "./historyEntries";
import type { TrainingReadResult } from "./trainingReadResult";
import type { HistorySessionRow } from "../repos/trainingSchemas";

/**
 * The live sessions of the week that starts on the Monday `weekStart` (`YYYY-MM-DD`) that hold a live
 * set, ended or not, newest first, each with its summary (core's `summariseSession`). A summary compares
 * nothing with the plan, and the routine is not read. The week is Monday to Sunday by the local date of
 * each session.
 *
 * What is cached is rows: the sessions with their sets under `keys.training.history(weekStart)`, which
 * the mobile cache keeps so the list opens without a connection. The summaries run in `select`, over
 * those rows, so they are worked out at read time, online or not. `enabled` false makes no request at
 * all. A date that is not a Monday fails without a request, as an error that is not retried.
 */
export function useHistoryWeek(
  weekStart: string,
  { enabled = true }: DiaryReadOptions = {},
): TrainingReadResult<HistoryEntry[]> {
  const client = useSupabase();

  const sessions = useQuery<HistorySessionRow[], Error, HistoryEntry[]>({
    queryKey: keys.training.history(weekStart),
    queryFn: () => listSessionsInWeek(client, weekStart),
    enabled,
    select: toHistoryEntries,
    retry: retryUnlessRangeError,
  });

  return toTrainingReadResult(sessions, [], []);
}
