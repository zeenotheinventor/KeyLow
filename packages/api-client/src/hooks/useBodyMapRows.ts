import { addCalendarDays, daysSinceMonday, isCalendarDay, toLocalDate } from "@keylow/core/dates";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { acceptedSuggestionsOf } from "./acceptedSuggestionsOf";
import { currentGoalOf } from "./currentGoalOf";
import { HEAT_LOOKBACK_DAYS, newestCachedSetRows } from "./heatWindowRows";
import { refetchFailedReads } from "./trainingReadResult";
import { useAcceptedSuggestions } from "./useAcceptedSuggestions";
import { useActiveRoutine } from "./useActiveRoutine";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useTrainingGoals } from "./useTrainingGoals";
import { useWeekSessionRows } from "./useWeekSessionRows";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listSetsFrom } from "../repos/training";

import type { BodyMapRows } from "./bodyMapModel";
import type { TrainingReadResult } from "./trainingReadResult";
import type { TrainingSet, WeekSession } from "../repos/trainingSchemas";
import type { AcceptedSuggestion } from "@keylow/core/training";

export type BodyMapReadOptions = {
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** The current moment, an ISO timestamp with a zone. It is never in a query key. */
  now: string;
  /**
   * False makes no request at all. The mobile app passes false while the terms gate is up, since it
   * stays mounted under the cover. Defaults to true.
   */
  enabled?: boolean | undefined;
  /** Whether the number needs the week's sessions (Projected, volume and gap do, Actual heat does not). */
  needsWeek: boolean;
};

/**
 * The sets of the window together with those of the week's sessions, each once by its id. The two reads
 * are cached apart, so the week can hold a set the window read before it was logged (a session logged
 * online on Wednesday, the app opened offline on Thursday), and every number counts what the cache holds.
 */
function withSetsOfSessions(
  sets: readonly TrainingSet[],
  sessions: readonly WeekSession[],
): TrainingSet[] {
  const byId = new Map(
    [...sets, ...sessions.flatMap((session) => session.sets)].map((set) => [set.id, set]),
  );
  return [...byId.values()];
}

const NO_ACCEPTED_SUGGESTIONS: readonly AcceptedSuggestion[] = [];

const WEEK_RULE = "A week must start on a Monday, written YYYY-MM-DD";

/**
 * Reads the cached rows the body map works from and gives what `compute` makes of them at `now`.
 *
 * The rows are the sets from 15 days before the Monday of the week through today, held under
 * `keys.training.sets(startDay)` (a key of a day and never of `now`), the week's sessions under
 * `keys.training.weekSessions(weekStart)`, the week's accepted suggestions under
 * `keys.training.acceptedSuggestions(weekStart)` (read only when the number needs the week, since
 * only the projection counts them), and the active routine, all kept in the mobile offline cache.
 * The window starts before the Monday and not before today, so a scrubber day early in the week still has
 * the 14 days of heat behind it. `compute` runs on every render that changes its inputs and its result is
 * never stored, so the numbers are always worked out at the moment asked, online or not.
 *
 * The result is pending until the time zone, the routine, the sets and (when needed) the week and its
 * accepted suggestions are all there, so no muscle is shown as under that the routine does not train. A
 * week that does not start on a Monday, or a `RangeError` from core, is an error that is not retried, and
 * a week that is wrong makes no request.
 */
export function useBodyMapRows<Data>(
  { weekStart, now, enabled = true, needsWeek }: BodyMapReadOptions,
  compute: (rows: BodyMapRows) => Data,
): TrainingReadResult<Data> {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const weekIsValid = isCalendarDay(weekStart) && daysSinceMonday(weekStart) === 0;
  const queryable = enabled && weekIsValid;
  const timeZone = useProfileTimeZone({ enabled: queryable });
  const routine = useActiveRoutine({ enabled: queryable });
  const goals = useTrainingGoals({ enabled: queryable });

  const zone = timeZone.data;
  const activeRoutine = routine.data;
  const currentGoals = currentGoalOf(goals);
  const instant = new Date(now);
  const today =
    zone && weekIsValid && !Number.isNaN(instant.getTime()) ? toLocalDate(instant, zone) : null;
  const startDay = weekIsValid ? addCalendarDays(weekStart, -HEAT_LOOKBACK_DAYS) : "";

  const sets = useQuery<TrainingSet[]>({
    queryKey: keys.training.sets(startDay),
    queryFn:
      today === null || activeRoutine === undefined
        ? skipToken
        : () => listSetsFrom(client, startDay, today),
    enabled: queryable,
    // Until the rows of this start day are there, the newest rows held under another stand in (a cache
    // restored in a later week than it was read). Not before the routine is known, so no muscle flashes
    // as under.
    placeholderData: () =>
      activeRoutine === undefined ? undefined : newestCachedSetRows(queryClient),
  });

  const week = useWeekSessionRows({
    weekStart,
    ready: Boolean(zone) && activeRoutine !== undefined,
    enabled: queryable && needsWeek,
  });

  const accepted = useAcceptedSuggestions(weekStart, { enabled: queryable && needsWeek });

  const reads = needsWeek
    ? [timeZone, routine, goals, sets, week, accepted]
    : [timeZone, routine, goals, sets];
  const sessions = week.data;
  const setRows = sets.data;
  const acceptedSuggestions = needsWeek ? acceptedSuggestionsOf(accepted) : NO_ACCEPTED_SUGGESTIONS;

  const computed = useMemo(() => {
    if (!enabled) {
      return null;
    }
    if (!weekIsValid) {
      return { error: new RangeError(WEEK_RULE) };
    }
    if (
      !zone ||
      activeRoutine === undefined ||
      currentGoals === undefined ||
      setRows === undefined
    ) {
      return null;
    }
    if (needsWeek && (sessions === undefined || acceptedSuggestions === undefined)) {
      return null;
    }
    try {
      return {
        data: compute({
          timeZone: zone,
          routine: activeRoutine,
          priority: currentGoals?.muscle_priority ?? null,
          sets: withSetsOfSessions(setRows, sessions ?? []),
          sessions: sessions ?? [],
          acceptedSuggestions: acceptedSuggestions ?? NO_ACCEPTED_SUGGESTIONS,
        }),
      };
    } catch (error) {
      if (error instanceof RangeError) {
        return { error };
      }
      throw error;
    }
  }, [
    enabled,
    weekIsValid,
    zone,
    activeRoutine,
    currentGoals,
    setRows,
    sessions,
    acceptedSuggestions,
    needsWeek,
    compute,
  ]);

  const refetch = refetchFailedReads(reads);
  if (computed !== null && "data" in computed) {
    return { data: computed.data, isPending: false, isError: false, error: null, refetch };
  }
  if (computed !== null) {
    return { data: undefined, isPending: false, isError: true, error: computed.error, refetch };
  }
  const failed = reads.find((read) => read.isError && read.data === undefined);
  return failed === undefined
    ? { data: undefined, isPending: true, isError: false, error: null, refetch }
    : { data: undefined, isPending: false, isError: true, error: failed.error, refetch };
}
