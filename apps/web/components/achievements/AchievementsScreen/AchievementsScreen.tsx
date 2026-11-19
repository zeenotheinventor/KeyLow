"use client";

import { useAchievementState } from "@keylow/api-client";

import { DEVICE_INPUTS, useSyncAchievements } from "../useSyncAchievements";

import { AchievementsError } from "@/components/achievements/AchievementsError";
import { AchievementsLoading } from "@/components/achievements/AchievementsLoading";
import { AchievementsView } from "@/components/achievements/AchievementsView";
import { useNow } from "@/lib/useNow";

/**
 * The Achievements page: the level, the streaks and the catalogue of the signed in user, or the loading or
 * error board. Opening it runs the engine and records what is new (see `useSyncAchievements`). A user with
 * no history is not an empty state: the catalogue is the page, with nothing earned yet. A failed refetch
 * keeps what was read, so only a page that never loaded is the error board.
 */
export function AchievementsScreen() {
  useSyncAchievements();
  const now = useNow();
  const state = useAchievementState({ device: DEVICE_INPUTS, now });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 lg:gap-6">
      {state.data !== undefined ? (
        <AchievementsView run={state.data.run} held={state.data.held} />
      ) : state.isError ? (
        <AchievementsError
          onRetry={() => {
            void state.refetch();
          }}
        />
      ) : (
        <AchievementsLoading />
      )}
    </div>
  );
}
