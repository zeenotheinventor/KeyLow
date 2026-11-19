import {
  appendFreezeEvents,
  fetchAchievementStats,
  fetchAchievementsBackfilledAt,
  keys,
  recordAchievements,
  useSupabase,
} from "@keylow/api-client";
import { runAchievements } from "@keylow/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

// The web knows nothing of the phone's reminders, so the one device input is fixed. A reminder badge is
// earned on the phone. It is a constant so a view built from it is not worked out again on every render.
export const DEVICE_INPUTS = { reminderEnabled: false };

/**
 * Runs the achievements engine once when the page opens and records what it finds, so the web never shows
 * a stale list and the phone sees new badges as unseen on its next open. A user with no backfill date gets
 * the quiet backfill, as on the phone. It never marks anything seen and queues no celebration: that is the
 * phone's. A run that fails is dropped, and the next visit makes it again. Nothing is logged: every number
 * read here is health data.
 */
export function useSyncAchievements(): void {
  const client = useSupabase();
  const queryClient = useQueryClient();

  useEffect(() => {
    const abort = new AbortController();
    // A call, so the compiler does not take the first check to hold after an await.
    const isStale = () => abort.signal.aborted;

    async function sync() {
      const [snapshot, backfilledAt] = await Promise.all([
        fetchAchievementStats(client),
        fetchAchievementsBackfilledAt(client),
      ]);
      if (isStale()) {
        return;
      }
      const isBackfill = backfilledAt === null;
      const run = runAchievements({
        stats: snapshot.stats,
        weighInDates: snapshot.weighInDates,
        held: snapshot.held.map(({ id }) => id),
        ledger: snapshot.ledger,
        device: DEVICE_INPUTS,
        now: new Date(),
        isBackfill,
      });
      const recorded = await recordAchievements(client, run.newUnlocks, isBackfill);
      if (isStale()) {
        return;
      }
      try {
        await appendFreezeEvents(client, run.freezeEventsToWrite);
      } finally {
        if (isBackfill || recorded.length > 0 || run.freezeEventsToWrite.length > 0) {
          void queryClient.invalidateQueries({ queryKey: keys.achievements.all });
        }
      }
    }

    sync().catch(() => {
      // The next visit makes the run again.
    });

    return () => {
      abort.abort();
    };
  }, [client, queryClient]);
}
