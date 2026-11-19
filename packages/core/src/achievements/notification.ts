import { levelUpNotification, unlockNotification } from "../copy/achievements";

import type { AchievementId } from "./catalogue";

export type LevelUp = Readonly<{ from: number; to: number; name: string }>;

/** The one notification a run sends. `achievementId` is the badge a tap opens, null for a level-up alone. */
export type UnlockNotificationPayload = Readonly<{
  title: string;
  body: string;
  achievementId: AchievementId | null;
}>;

export type NotificationInput = Readonly<{
  /** The badges this run earned, highest tier first. The first one is the one a tap opens. */
  newUnlocks: readonly AchievementId[];
  points: number;
  freezes: number;
  levelUp: LevelUp | null;
}>;

/**
 * One payload for everything a run earned, never more. Badges are grouped into one title, and a new
 * level or freezes ride along in the body. A level-up with no badge gets its own payload, and a run
 * with neither sends nothing. Points only come from badges, so that level-up alone is a guard rather
 * than a case that real stats reach.
 */
export const buildNotification = ({
  newUnlocks,
  points,
  freezes,
  levelUp,
}: NotificationInput): UnlockNotificationPayload | null => {
  const [firstId] = newUnlocks;
  if (firstId !== undefined) {
    return {
      ...unlockNotification({
        badgeIds: newUnlocks,
        points,
        freezes,
        reachedLevelName: levelUp?.name ?? null,
      }),
      achievementId: firstId,
    };
  }
  if (levelUp === null) {
    return null;
  }
  return {
    ...levelUpNotification({ level: levelUp.to, levelName: levelUp.name, freezes }),
    achievementId: null,
  };
};
