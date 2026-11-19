import { unseenBackfilledIdsOf } from "@keylow/core";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { achievementsPath } from "../../../lib/achievementRoutes";
import { BackfillCard } from "../BackfillCard";
import { useAchievementsState } from "../useAchievementsState";
import { useMarkAchievementsSeen } from "../useMarkAchievementsSeen";

import type { DashboardBackfillCardProps } from "./types";

// The ids the person dismissed, kept in the query cache so a remount of the Dashboard finds them, a failed or
// slow write cannot bring the card back this session, and signing out, which clears the cache, forgets them.
// It sits outside the `achievements` keys, so the read's invalidation never refetches it.
const DISMISSED_KEY = ["achievementsBackfillDismissed"] as const;

/**
 * The backfill card for the Dashboard. Its count is the held rows the live sync recorded as backfilled and
 * the person has not seen, read from the database and not from the celebration queue, which is lost when
 * the app closes. It shows only while there are some. See your badges opens the Achievements screen, which
 * marks them seen. Dismiss marks exactly those seen and hides the card at once, optimistically, and it stays
 * hidden for the session even if the write fails. The next launch finds them unseen and may try again.
 */
export function DashboardBackfillCard({ isReadEnabled }: DashboardBackfillCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const markSeen = useMarkAchievementsSeen();
  const { data } = useAchievementsState({ enabled: isReadEnabled });
  const { data: dismissedIds = [] } = useQuery<string[]>({
    queryKey: DISMISSED_KEY,
    queryFn: skipToken,
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const backfilledIds = data === undefined ? [] : unseenBackfilledIdsOf(data.held);
  const shownIds = backfilledIds.filter((id) => !dismissedIds.includes(id));
  if (data === undefined || shownIds.length === 0) {
    return null;
  }

  return (
    <BackfillCard
      badgeCount={shownIds.length}
      level={data.run.level.level}
      onDismiss={() => {
        // The ids are read now. A backfill run still writing can add rows after this, and they would show
        // the card again with their own count, which is right: they are badges this Dismiss never saw.
        queryClient.setQueryData<string[]>(DISMISSED_KEY, (previous = []) => [
          ...new Set([...previous, ...shownIds]),
        ]);
        void markSeen(shownIds);
      }}
      onSeeBadges={() => {
        router.push(achievementsPath());
      }}
    />
  );
}
