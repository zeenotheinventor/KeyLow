import { addCalendarDays, isCalendarDay, toLocalDate } from "@keylow/core/dates";
import {
  SUGGEST_PARAMS_V2,
  TRAINING_PARAMS_V2,
  muscleState,
  suggestSession,
} from "@keylow/core/training";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { HEAT_LOOKBACK_DAYS, newestCachedSetRows } from "./heatWindowRows";
import { plannedDayOf } from "./plannedDayOf";
import { planRoutineOf } from "./planRoutineOf";
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
import type { Suggestion } from "@keylow/core/training";

/** Why there is no suggestion to show: the user has not answered the questionnaire, or the library has not been read. */
export type SuggestionUnavailableReason = "no_goal" | "no_library";

/**
 * What `useSuggestion` gives. `kind` is the suggestion's (`session`, `plan_adjusted` or `nothing`), and
 * `unavailable` says why there is none, so a screen can show the right state: `no_goal` offers the
 * questionnaire, `no_library` shows no card.
 */
export type SuggestionRead =
  | { kind: Suggestion["kind"]; suggestion: Suggestion; unavailable: null }
  | { kind: null; suggestion: null; unavailable: SuggestionUnavailableReason };

export type UseSuggestionInput = DiaryReadOptions & {
  /** The local calendar day the suggestion is for, `YYYY-MM-DD` in the user's zone. */
  day: string;
  /** The moment to work the suggestion out at, an ISO timestamp with a zone. */
  now: string;
};

const NO_GOAL: SuggestionRead = { kind: null, suggestion: null, unavailable: "no_goal" };
const NO_LIBRARY: SuggestionRead = { kind: null, suggestion: null, unavailable: "no_library" };

/**
 * The next session for the local day `day`, worked out at `now` (core's `suggestSession`): the routine
 * day planned for `day` kept and added to (`plan_adjusted`), a fresh `session` when the routine has none,
 * or `nothing`. With no goal it gives `no_goal` and never guesses priorities, and with the library not
 * read in this session and no connection it gives `no_library`.
 *
 * What is cached is rows, and nothing worked out from them is. The sets are the same read as the body
 * map's, under `keys.training.sets(startDay)` (a key of a day, never of `now`), and the routine and the
 * goal are shared with it too, all persisted on mobile. The exercise library is `useSuggestionLibrary`'s
 * read, of the goal's equipment, and is never persisted. Core's `muscleState` and `suggestSession` run in
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
      if (!isCalendarDay(day)) {
        throw new RangeError("A suggestion day must be a calendar date written YYYY-MM-DD");
      }
      if (currentGoal === null) {
        return NO_GOAL;
      }
      if (libraryRows === undefined) {
        return libraryOutOfReach ? NO_LIBRARY : undefined;
      }
      const plannedDay = plannedDayOf(planRoutineOf(activeRoutine ?? null, zone), day);
      const suggestion = suggestSession(
        muscleState(sets, now, TRAINING_PARAMS_V2),
        currentGoal,
        libraryRows,
        plannedDay === undefined ? {} : { plannedDay },
        SUGGEST_PARAMS_V2,
      );
      return { kind: suggestion.kind, suggestion, unavailable: null };
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
