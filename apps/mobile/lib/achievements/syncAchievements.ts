import {
  appendFreezeEvents,
  fetchAchievementStats,
  fetchAchievementsBackfilledAt,
  keys,
  recordAchievements,
} from "@keylow/api-client";
import { decideCelebrations, reminderEnabledFrom, runAchievements } from "@keylow/core";
import { AppState } from "react-native";

import { getQueuedIds, recordCelebrations } from "./celebrationStore";
import { readReminderSettings } from "../reminderSettings";

import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

/**
 * One run of the achievements engine for the signed in user: read the stats, work out what is earned,
 * record it, write the freezes, and leave what to celebrate in the queue. The first run of a user whose
 * profile has no backfill date is the quiet backfill. A run that fails part way throws, writes nothing
 * it needs to remember, and is simply made again by the next trigger. Nothing is logged: every number
 * here is health data. `isCurrent` says whether the user who started the run is still signed in: a run
 * that is no longer current stops after the await it was in and writes and queues nothing.
 */
export async function syncAchievements(
  client: SupabaseClient<Database>,
  queryClient: QueryClient,
  isCurrent: () => boolean,
): Promise<void> {
  const [snapshot, backfilledAt, reminders] = await Promise.all([
    fetchAchievementStats(client),
    fetchAchievementsBackfilledAt(client),
    readReminderSettings(),
  ]);
  if (!isCurrent()) {
    return;
  }
  const isBackfill = backfilledAt === null;

  const run = runAchievements({
    stats: snapshot.stats,
    weighInDates: snapshot.weighInDates,
    held: snapshot.held.map(({ id }) => id),
    ledger: snapshot.ledger,
    device: {
      reminderEnabled: reminderEnabledFrom(reminders),
    },
    now: new Date(),
    isBackfill,
  });

  const recorded = await recordAchievements(client, run.newUnlocks, isBackfill);
  if (!isCurrent()) {
    return;
  }
  // Queued before the freezes are written, so a failed freeze write does not lose the celebration.
  recordCelebrations(
    decideCelebrations({
      run,
      recorded,
      held: snapshot.held,
      isBackfill,
      alreadyQueued: getQueuedIds(),
    }),
    AppState.currentState === "active",
  );

  try {
    await appendFreezeEvents(client, run.freezeEventsToWrite);
  } finally {
    if (isBackfill || recorded.length > 0 || run.freezeEventsToWrite.length > 0) {
      void queryClient.invalidateQueries({ queryKey: keys.achievements.all });
    }
  }
}
