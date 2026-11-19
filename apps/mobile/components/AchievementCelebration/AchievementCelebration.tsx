import { summariseCelebrations } from "@keylow/core";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { resetCelebrations, useCelebrationQueue } from "../../lib/achievements";
import { useMarkAchievementsSeen } from "../AchievementsScreen";
import { AchievementMoment } from "./AchievementMoment";
import { CelebrationToast } from "./CelebrationToast";
import { useIsAppActive } from "./useIsAppActive";
import { achievementPath, achievementsPath } from "../../lib/achievementRoutes";
import { haptic } from "../../lib/haptics";

import type { CelebrationSummary } from "@keylow/core";

type Shown = { key: number; summary: CelebrationSummary };

/**
 * Draws nothing until a badge is earned. While the app is in front it takes everything waiting in the
 * celebration queue at once and shows exactly one celebration for it: the toast, or the full-screen moment
 * for a new Gold or Platinum (`summariseCelebrations` decides which). Every badge of the drain is then taken
 * out of the queue and marked seen, so nothing celebrates twice, a restart included. A drain that arrives
 * while the moment is on screen waits for it to be closed, so a toast and a moment never show together.
 */
export function AchievementCelebration() {
  const { entries, extras, acknowledge } = useCelebrationQueue();
  const isActive = useIsAppActive();
  const markSeen = useMarkAchievementsSeen();
  const router = useRouter();
  const [shown, setShown] = useState<Shown | null>(null);
  const lastKey = useRef(0);
  const lastDrained = useRef<typeof entries | null>(null);
  const isMomentOpen = shown?.summary.kind === "moment";

  // This is mounted per account, so when the account changes or signs out the waiting badges and the ids already
  // celebrated go with it, whether or not the sync had started, and the next account starts clean.
  useEffect(() => resetCelebrations, []);

  useEffect(() => {
    if (!isActive || entries.length === 0 || isMomentOpen || lastDrained.current === entries) {
      return;
    }
    const summary = summariseCelebrations({ entries, extras });
    if (summary === null) {
      return;
    }
    lastDrained.current = entries;
    lastKey.current += 1;
    setShown({ key: lastKey.current, summary });
    acknowledge(summary.ids);
    // Not awaited: a write that fails only means one more grouped toast after a restart, as the rows stay unseen.
    void markSeen(summary.ids);
    void (summary.kind === "moment" ? haptic.complete() : haptic.select());
  }, [isActive, entries, extras, isMomentOpen, acknowledge, markSeen]);

  if (shown === null) {
    return null;
  }
  const { key, summary } = shown;
  const close = () => {
    setShown((current) => (current?.key === key ? null : current));
  };

  return summary.kind === "moment" ? (
    <AchievementMoment
      key={key}
      summary={summary}
      onDismiss={close}
      onSeeAll={() => {
        close();
        router.push(achievementsPath());
      }}
    />
  ) : (
    <CelebrationToast
      key={key}
      summary={summary}
      onClose={close}
      onView={() => {
        router.push(achievementPath(summary.leadId));
      }}
    />
  );
}
