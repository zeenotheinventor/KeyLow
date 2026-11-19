import { ACHIEVEMENTS } from "./catalogue";
import { ACHIEVEMENTS_EARNED_RULE, MEASURES } from "./rules";
import { toLocalDate } from "../dates/toLocalDate";

import type { AchievementId } from "./catalogue";
import type { RuleInput } from "./rules";
import type { AchievementStats } from "./stats";
import type { StreakInput } from "./streakInput";

export type AchievementProgress = Readonly<{ current: number; target: number }>;

/** One achievement's standing: earned, or locked with how far along it is. */
export type AchievementResult =
  | Readonly<{ id: AchievementId; earned: true }>
  | Readonly<{ id: AchievementId; earned: false; progress: AchievementProgress }>;

/**
 * Every achievement of the catalogue, in its order, earned or locked with its progress. Pure: `now` is an
 * argument, nothing reads the clock, and the same input always gives the same answer. Collector and
 * Completionist count the other 128, so they are settled after those.
 */
export const evaluateAchievements = (
  stats: AchievementStats,
  streaks: StreakInput,
  now: Date,
): readonly AchievementResult[] => {
  const input: RuleInput = { stats, streaks, now, today: toLocalDate(now, stats.timeZone) };
  const settle = (id: AchievementId, current: number, target: number): AchievementResult =>
    current >= target ? { id, earned: true } : { id, earned: false, progress: { current, target } };

  // Collector and Completionist read nothing from the stats, so their slot waits for the count below.
  const measured = ACHIEVEMENTS.map(({ rule }) =>
    rule === ACHIEVEMENTS_EARNED_RULE ? null : MEASURES[rule](input),
  );
  const othersEarned = ACHIEVEMENTS.filter(
    ({ target }, index) => (measured[index] ?? -1) >= target,
  ).length;

  return ACHIEVEMENTS.map(({ id, target }, index) =>
    settle(id, measured[index] ?? othersEarned, target),
  );
};
