import { keys, markAchievementsSeen, useSupabase } from "@keylow/api-client";
import { withSeen } from "@keylow/core";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { AchievementSnapshot } from "@keylow/api-client";

/**
 * Marks the given achievements seen. The cached read is stamped first, so every screen drops what depended
 * on them being unseen at once, then the write is made, then the read is invalidated to take what the
 * database holds. A write that fails leaves the stamp until the next read, and the next open of the screen
 * finds the same rows still unseen and tries again. Nothing is logged, because which badges a person holds is
 * health data.
 */
export function useMarkAchievementsSeen() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useCallback(
    async (ids: readonly string[]) => {
      if (ids.length === 0) {
        return;
      }
      const seenAt = new Date().toISOString();
      queryClient.setQueryData<AchievementSnapshot>(keys.achievements.state, (snapshot) =>
        snapshot === undefined
          ? snapshot
          : { ...snapshot, held: withSeen(snapshot.held, ids, seenAt) },
      );
      try {
        await markAchievementsSeen(client, ids);
        await queryClient.invalidateQueries({ queryKey: keys.achievements.all });
      } catch {
        // Left for the next open of the screen, which finds the same rows still unseen.
      }
    },
    [client, queryClient],
  );
}
