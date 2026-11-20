import { ACHIEVEMENTS } from "./catalogue";

import type { AchievementCategory, AchievementId } from "./catalogue";

const SENSITIVE_CATEGORIES: readonly AchievementCategory[] = ["weight-and-body"];

/** Badges outside those categories whose name or meaning still reveals weight or body measurements. */
const SENSITIVE_IDS_OUTSIDE_SENSITIVE_CATEGORIES: readonly AchievementId[] = [
  "on-the-scales",
  "measured-up",
];

/**
 * Whether a badge's name or meaning reveals weight, body measurements or body composition. Such a
 * badge never has its name on a lock screen, so a phone seen by someone else says nothing about it.
 */
export const isSensitiveAchievement = (id: AchievementId): boolean =>
  SENSITIVE_IDS_OUTSIDE_SENSITIVE_CATEGORIES.includes(id) ||
  ACHIEVEMENTS.some(
    (achievement) => achievement.id === id && SENSITIVE_CATEGORIES.includes(achievement.category),
  );
