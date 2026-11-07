import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { nextSessionSuggestion } from "@keylow/core/training";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { HEAT_LOOKBACK_DAYS, newestCachedSetRows } from "./heatWindowRows";
import { toTrainingReadResult } from "./trainingReadResult";
import { useActiveRoutine } from "./useActiveRoutine";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSuggestionLibrary } from "./useSuggestionLibrary";
import { useTrainingGoals } from "./useTrainingGoals";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listSetsFrom } from "../repos/training";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { TrainingSet } from "../repos/trainingSchemas";
import type { SuggestionRead } from "@keylow/core/training";

export type { SuggestionRead, SuggestionUnavailableReason } from "@keylow/core/training";

export type UseSuggestionInput = DiaryReadOptions & {
  /** The local calendar day the suggestion is for, `YYYY-MM-DD` in the user's zone. */
  day: string;
  /** The moment to work the suggestion out at, an ISO timestamp with a zone. */
  now: string;
};

/**
 * The next session for the local day `day`, worked out at `now` (core's `suggestSession`): the routine
 * day planned for `day` kept and added to (`plan_adjusted`), a fresh `session` when the routine has none,
 * or `nothing`. With no goal it gives `no_goal` and never guesses priorities, and with the library not
 * read in this session and no connection it gives `no_library`. The calculation is core's
 * `nextSessionSuggestion`, which the assistant's tools run too.
 *
 * What is cached is rows, and nothing worked out from them is. The sets are the same read as the body
 * map's, under `keys.training.sets(startDay)` (a key of a day, never of `now`), and the routine and the
 * goal are shared with it too, all persisted on mobile. The exercise library is `useSuggestionLibrary`'s
 * read, of the goal's equipment, and is never persisted. `nextSessionSuggestion` runs in
 * `select`, so the suggestion is worked out at the `now` given, from whatever rows are cached, online or
 * not. `day` and `now` are in no key.
 *
 * The result is pending until the time zone, the routine, the goal and the sets are there, and while the
 * library is being read. A failed read is an error that names the action and the database code only.
 * `enabled` false makes no request at all. A `day` that is not a calendar day, or a `now` that is not an
 * ISO timestamp with a zone, gives a `RangeError` that does not quote it.
 */
export function useSuggestion({
  day,
  now,
  enabled = true,
}: UseSuggestionInput): TrainingReadResult<SuggestionRead> {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const timeZone = useProfileTimeZone({ enabled });
  const routine = useActiveRoutine({ enabled });
  const goals = useTrainingGoals({ enabled });
  const library = useSuggestionLibrary(goals.data?.equipment, { enabled });

  const zone = timeZone.data;
  const today = zone ? toLocalDate(new Date(now), zone) : null;
  const startDay = today === null ? "" : addCalendarDays(today, -HEAT_LOOKBACK_DAYS);
  const activeRoutine = routine.data;
  const currentGoal = goals.data;
  const libraryRows = library.data;
  // Nothing is cached and there is no connection to read it: the card is not shown, and nothing is waited for.
  const libraryOutOfReach = libraryRows === undefined && library.fetchStatus === "paused";

  const select = useCallback(
    (sets: TrainingSet[]): SuggestionRead | undefined => {
      if (!zone || currentGoal === undefined) {
        return undefined;
      }
      const read = nextSessionSuggestion({
        sets,
        now,
        goal: currentGoal,
        library: libraryRows ?? null,
        activeRoutine: activeRoutine ?? null,
        timeZone: zone,
        day,
      });
      // A library still being read is not a missing one: the card waits for it.
      return read.unavailable === "no_library" && !libraryOutOfReach ? undefined : read;
    },
    [zone, day, now, activeRoutine, currentGoal, libraryRows, libraryOutOfReach],
  );

  // Until today's rows are there, the newest rows held under another start day stand in (a cache restored
  // on a later day than it was read). Not before the routine and the goal are known.
  const standInRows = useCallback(
    () =>
      activeRoutine === undefined || currentGoal === undefined
        ? undefined
        : newestCachedSetRows(queryClient),
    [queryClient, activeRoutine, currentGoal],
  );

  const sets = useQuery({
    queryKey: keys.training.sets(startDay),
    queryFn:
      today === null || activeRoutine === undefined || currentGoal === undefined
        ? skipToken
        : () => listSetsFrom(client, startDay, today),
    enabled,
    select,
    placeholderData: standInRows,
  });

  return toTrainingReadResult(
    sets,
    [timeZone, routine, goals, library],
    [timeZone, routine, goals],
  );
}
