import { keys, useSupabase } from "@keylow/api-client";
import { hashKey, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { resetCelebrations } from "./celebrationStore";
import { syncAchievements } from "./syncAchievements";
import { createSyncScheduler } from "./syncScheduler";
import { useReadsEnabled } from "../useReadsEnabled";

const assistantChangesHash = hashKey(keys.assistant.changes);

// Long enough that a run of quick logs is one run, short enough that the badge comes while the person
// is still looking at the screen.
const DEBOUNCE_MILLISECONDS = 2000;

/**
 * Keeps the achievements up to date for the signed in user, with no screen of its own. A run is made when
 * this mounts (sign in and app open), each time the app returns to the foreground (which covers a new day,
 * a freeze being used and anything done on the web while away), and after any write that succeeded, with
 * a short wait so a burst of writes is one run. A write is seen where every write passes: the mutation
 * cache, so a mutation that is added later is covered with no change here. The assistant does its writes
 * on the server, and the app learns of them when it refreshes the assistant's changes, which is the other
 * trigger. Nothing is read until the account has accepted the current Terms. Mount it once, where a user
 * is signed in.
 */
export function useAchievementSync(accountId: string | null): void {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const isEnabled = useReadsEnabled();

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    let isCurrent = true;
    const scheduler = createSyncScheduler(
      () => syncAchievements(client, queryClient, () => isCurrent, accountId),
      DEBOUNCE_MILLISECONDS,
    );
    const stopWatchingWrites = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        scheduler.schedule();
      }
    });
    const stopWatchingAssistant = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "invalidate" &&
        event.query.queryHash === assistantChangesHash
      ) {
        scheduler.schedule();
      }
    });
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        scheduler.runNow();
      }
    });
    scheduler.runNow();

    return () => {
      isCurrent = false;
      scheduler.stop();
      stopWatchingWrites();
      stopWatchingAssistant();
      appState.remove();
      resetCelebrations();
    };
  }, [client, queryClient, isEnabled, accountId]);
}
