import { localToday } from "@keylow/core";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { checkinFailureCode } from "./checkinFailureCode";
import { useRunDueCheckins } from "./useRunDueCheckins";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyCheckinSchedule } from "../repos/checkin";
import { getMyTargets } from "../repos/targets";

import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

/**
 * The calorie target as it stands now: null when the user has none, undefined when it could not be read.
 * A read already in flight (the diary's own, on a cold open) is joined, and a read that is not stale is
 * answered from the cache, so nothing is read twice. An invalidated read always counts as stale, so after
 * a run this finishes the refetch the run asked for, or joins it, rather than trusting a cache that may
 * still hold the old figure. The target is health data, so it is only ever compared and never logged or
 * sent anywhere, and a failed read says nothing: the check-in matters more than the toast.
 */
async function readCalorieTarget(
  queryClient: QueryClient,
  client: SupabaseClient<Database>,
): Promise<number | null | undefined> {
  try {
    const targets = await queryClient.query({
      queryKey: keys.profiles.targets,
      queryFn: () => getMyTargets(client),
      staleTime: Infinity,
    });
    return targets.kcal;
  } catch {
    return undefined;
  }
}

/** What `useRunCheckinsIfDue` takes. The callbacks may be inline: the latest ones are called, and the returned function keeps its identity. */
export type UseRunCheckinsIfDueOptions = {
  /** Called once when a run recorded check-ins and the calorie target is not what it was. */
  onNewTargets: () => void;
  /** Called with the code of a failure and nothing else, since a message can quote a health value. */
  onFailureCode: (code: string) => void;
};

/**
 * Gives a function that runs the user's due check-ins and draws nothing. It reads the program's next
 * check-in date, and when that day has come in the profile's time zone it runs the check-ins. The caller
 * decides when to call it (when the app opens and each time it returns to the foreground, once the user may
 * read their data) and passes what happens with the outcome. Offline it does nothing. A call that finds a
 * run already under way joins it: they share one run, one `onNewTargets` and one `onFailureCode`. A failure
 * goes to `onFailureCode` as a code only, and never throws, since the daily backstop runs the check-in
 * anyway. When a run recorded check-ins and the calorie target is not what it was, `onNewTargets` is called,
 * even if the run answered with none left. The target is health data, so it is only compared and never
 * passed on. Once the screen using it unmounts, a call still under way starts no run and announces nothing,
 * so a sign-out does not hand its new target to the next account. The returned function keeps its identity
 * between renders.
 */
export function useRunCheckinsIfDue({
  onNewTargets,
  onFailureCode,
}: UseRunCheckinsIfDueOptions): () => Promise<void> {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const { mutateAsync: runDueCheckins } = useRunDueCheckins();
  const latestCallbacks = useRef({ onNewTargets, onFailureCode });
  const runInFlight = useRef<Promise<void> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    latestCallbacks.current = { onNewTargets, onFailureCode };
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(async () => {
    if (!onlineManager.isOnline()) {
      return;
    }

    async function runAndAnnounce() {
      const targetBefore = await readCalorieTarget(queryClient, client);
      const answer = await runDueCheckins();
      // Without a target from before the run there is nothing to compare with.
      if (answer !== null && answer.ran > 0 && targetBefore !== undefined) {
        const targetAfter = await readCalorieTarget(queryClient, client);
        if (isMounted.current && targetAfter !== undefined && targetAfter !== targetBefore) {
          latestCallbacks.current.onNewTargets();
        }
      }
    }

    try {
      const schedule = await getMyCheckinSchedule(client);
      // A read that finishes after the screen is gone, as when the person signs out, starts nothing.
      if (!isMounted.current || schedule === null || schedule.nextCheckinDate === null) {
        return;
      }
      // Dates in `YYYY-MM-DD` order the same as text.
      if (localToday(new Date().toISOString(), schedule.timeZone) < schedule.nextCheckinDate) {
        return;
      }
      // The run reports its own failure, so the callers that joined it do not report it again.
      runInFlight.current ??= runAndAnnounce()
        .catch((failure: unknown) => {
          latestCallbacks.current.onFailureCode(checkinFailureCode(failure));
        })
        .finally(() => {
          runInFlight.current = null;
        });
      await runInFlight.current;
    } catch (failure) {
      latestCallbacks.current.onFailureCode(checkinFailureCode(failure));
    }
  }, [client, queryClient, runDueCheckins]);
}
