import { levelNameFor } from "../copy/achievements";

import type { AchievementTier } from "./catalogue";

/** What each tier is worth. Points are only ever added, so a total never goes down. */
export const TIER_POINTS: Readonly<Record<AchievementTier, number>> = {
  bronze: 10,
  silver: 25,
  gold: 50,
  platinum: 100,
};

/** The points of the tiers given, one entry per earned achievement. */
export const totalPoints = (earnedTiers: readonly AchievementTier[]): number =>
  earnedTiers.reduce((sum, tier) => sum + TIER_POINTS[tier], 0);

const POINTS_PER_LEVEL_STEP = 50;

/** The total points level `level` needs: 50 x n x (n + 1) / 2. Level 0 is where everyone starts. */
export const pointsForLevel = (level: number): number =>
  (POINTS_PER_LEVEL_STEP * level * (level + 1)) / 2;

export type LevelStanding = Readonly<{
  level: number;
  name: string;
  totalPoints: number;
  /** Points earned inside this level against the points the next level asks of it. */
  progress: Readonly<{ current: number; target: number }>;
}>;

/** The level a points total has reached, its name and the progress to the next one. */
export const levelFor = (points: number): LevelStanding => {
  if (!Number.isInteger(points) || points < 0) {
    throw new RangeError("Points are a whole number of zero or more.");
  }
  // The closed form can land one off at an exact threshold, so the two loops settle it.
  let level = Math.floor((Math.sqrt(1 + (8 * points) / POINTS_PER_LEVEL_STEP) - 1) / 2);
  while (pointsForLevel(level + 1) <= points) {
    level += 1;
  }
  while (pointsForLevel(level) > points) {
    level -= 1;
  }
  const levelStart = pointsForLevel(level);
  return {
    level,
    name: levelNameFor(level),
    totalPoints: points,
    progress: { current: points - levelStart, target: pointsForLevel(level + 1) - levelStart },
  };
};
