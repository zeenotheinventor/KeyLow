import { useAchievementSync } from "../useAchievementSync";

/** Draws nothing. Keeps the signed in user's achievements up to date (`useAchievementSync`). */
export function AchievementSync() {
  useAchievementSync();

  return null;
}
