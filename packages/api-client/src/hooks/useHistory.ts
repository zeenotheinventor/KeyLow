import { groupSessionsByWeek } from "@keylow/core/training";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import { toHistoryEntries } from "./historyEntries";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { findPreviousSessionWeek, listSessionsInWeek } from "../repos/trainingHistory";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { HistoryWeek } from "./historyEntries";
import type { TrainingReadResult } from "./trainingReadResult";
import type { Database } from "../database.types";
import type { HistorySessionRow } from "../repos/trainingSchemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InfiniteData } from "@tanstack/react-query";

/**
 * One page of the history list: a week that has a session with a logged set, its sessions as rows, and
 * the Monday of the week before it that has one (null when there is none). A page with no week is the
 * whole history of a user who has not logged a set.
 */
type HistoryPage = {
  weekStart: string | null;
  sessions: HistorySessionRow[];
  previousWeekStart: string | null;
};

// The first page asks for the newest week with a session, whatever the date is today, so the key and the
// stored pages hold no clock.
const NEWEST_WEEK: string | null = null;

async function readHistoryPage(
  client: SupabaseClient<Database>,
  requestedWeekStart: string | null,
): Promise<HistoryPage> {
  const weekStart = requestedWeekStart ?? (await findPreviousSessionWeek(client));
  if (weekStart === null) {
    return { weekStart: null, sessions: [], previousWeekStart: null };
  }
  // `getNextPageParam` cannot wait for a request, so the page carries the week that follows it.
  const [sessions, previousWeekStart] = await Promise.all([
    listSessionsInWeek(client, weekStart),
    findPreviousSessionWeek(client, weekStart),
  ]);
  return { weekStart, sessions, previousWeekStart };
}

export type UseHistoryOptions = DiaryReadOptions & {
  /** How many weeks to load at least: further weeks are asked for until this many are there or there are no more. */
  weeks: number;
};

export type UseHistoryResult = TrainingReadResult<HistoryWeek[]> & {
  /** Whether a week with a session exists before the last one loaded. */
  hasEarlierWeeks: boolean;
  isLoadingEarlierWeeks: boolean;
  /**
   * Loads the next earlier week that has a session. It rejects when that week does not load, with an error
   * that names the action and the database code only. The weeks already on screen stay.
   */
  loadEarlierWeeks: () => Promise<void>;
};

/**
 * The history list: the calendar weeks (Monday to Sunday, by each session's local date) that have a
 * session with at least one logged set, newest week first and newest session first within a week (core's
 * `groupSessionsByWeek`), each with its session count and working-set total. A session shows whether or
 * not it was ended and however far it strayed from the plan, so the open session is in its week; a
 * session with no live set, or deleted, never is. Each session carries its summary (name, duration,
 * sets and top muscles). The list shows no comparison with the plan, which belongs to the session
 * detail, so the summary is worked out with no planned day and the routine is not read.
 *
 * It is an infinite read whose pages are weeks. A page is found with `findPreviousSessionWeek`, so a
 * week with no logged set is never a page, and `loadEarlierWeeks` loads the next one. At least `weeks`
 * weeks are loaded without being asked, as far as the history goes.
 *
 * What is cached is rows, under `keys.training.historyList`: the pages with their sessions and sets,
 * which the mobile cache keeps so the list opens without a connection. The summaries and the grouping
 * run in `select`, over those rows and the user's time zone, so they are worked out at read time. The
 * result is pending until the zone has been read. A page that fails after the first never replaces the
 * weeks on screen. `enabled` false makes no request at all.
 */
export function useHistory({ weeks, enabled = true }: UseHistoryOptions): UseHistoryResult {
  const client = useSupabase();
  const timeZone = useProfileTimeZone({ enabled });

  const zone = timeZone.data;

  const select = useCallback(
    (data: InfiniteData<HistoryPage, string | null>): HistoryWeek[] | undefined => {
      if (!zone) {
        return undefined;
      }
      const sessions = data.pages.flatMap((page) => page.sessions);
      return groupSessionsByWeek(toHistoryEntries(sessions, undefined), zone);
    },
    [zone],
  );

  const history = useInfiniteQuery<
    HistoryPage,
    Error,
    HistoryWeek[] | undefined,
    typeof keys.training.historyList,
    string | null
  >({
    queryKey: keys.training.historyList,
    initialPageParam: NEWEST_WEEK,
    queryFn: ({ pageParam }) => readHistoryPage(client, pageParam),
    getNextPageParam: (lastPage) => lastPage.previousWeekStart,
    enabled,
    select,
    retry: retryUnlessRangeError,
  });

  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = history;
  const loadedWeeks = history.data?.length;

  useEffect(() => {
    if (
      loadedWeeks !== undefined &&
      loadedWeeks < weeks &&
      hasNextPage &&
      !isFetching &&
      !isFetchNextPageError
    ) {
      void fetchNextPage();
    }
  }, [loadedWeeks, weeks, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return {
    ...toTrainingReadResult(history, [timeZone], [timeZone]),
    hasEarlierWeeks: hasNextPage,
    isLoadingEarlierWeeks: history.isFetchingNextPage,
    loadEarlierWeeks: async () => {
      const result = await fetchNextPage();
      if (result.isError) {
        throw result.error;
      }
    },
  };
}
