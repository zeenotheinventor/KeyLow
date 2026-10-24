import {
  getMyCheckinSchedule,
  getMyTargets,
  keys,
  toEdgeErrorKind,
  useRunDueCheckins,
  useSupabase,
} from "@keylow/api-client";
import { localToday } from "@keylow/core";
import { captureException } from "@sentry/react-native";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";

import { announceNewTargets } from "../../lib/checkinToast";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

/**
 * The code of a failure and nothing else: the edge error code, or the database's own code, or `failed`
 * for anything that is not a typed answer (no connection, a body that was not what the contract says).
 * A message can quote a health value, so it is never read.
 */
function failureCodeOf(failure: unknown): string {
  if (!(failure instanceof Error)) {
    return "failed";
  }

  const kind = toEdgeErrorKind(failure);
  const { cause } = failure;
  if (
    kind === "failed" &&
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string" &&
    cause.code !== ""
  ) {
    return cause.code;
  }

  return kind;
}

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

/**
 * Draws nothing. Runs the user's due check-ins when the app opens and each time it returns to the
 * foreground, so the new targets are there before the diary is looked at: it reads the program's next
 * check-in date, and when that day has come in the profile's time zone it runs the check-ins once (a
 * return to the foreground while one runs joins it). Nothing runs in the background, and nothing is
 * read until the Terms are accepted. Offline it does nothing. Any other failure shows nothing and goes
 * to Sentry as a code only, since the daily backstop runs the check-in anyway. When a run recorded
 * check-ins and the calorie target is not what it was, it tells the diary a new target exists. Mount it
 * once, where a person is signed in.
 */
export function CheckinRunner() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const isEnabled = useReadsEnabled();
  const { mutateAsync: runDueCheckins } = useRunDueCheckins();

  const runIfDue = useCallback(async () => {
    if (!onlineManager.isOnline()) {
      return;
    }
    try {
      const schedule = await getMyCheckinSchedule(client);
      if (schedule === null || schedule.nextCheckinDate === null) {
        return;
      }
      // Dates in `YYYY-MM-DD` order the same as text.
      if (localToday(new Date().toISOString(), schedule.timeZone) < schedule.nextCheckinDate) {
        return;
      }
      const targetBefore = await readCalorieTarget(queryClient, client);
      const answer = await runDueCheckins();
      // Without a target from before the run there is nothing to compare with.
      if (answer !== null && answer.ran > 0 && targetBefore !== undefined) {
        const targetAfter = await readCalorieTarget(queryClient, client);
        if (targetAfter !== undefined && targetAfter !== targetBefore) {
          announceNewTargets();
        }
      }
    } catch (failure) {
      captureException(new Error(`Could not run your check-in (${failureCodeOf(failure)})`));
    }
  }, [client, queryClient, runDueCheckins]);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    void runIfDue();
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") {
        void runIfDue();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [isEnabled, runIfDue]);

  return null;
}
