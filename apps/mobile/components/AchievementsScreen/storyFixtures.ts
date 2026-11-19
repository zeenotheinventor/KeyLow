import { ACHIEVEMENTS, achievementsOverview, badgeDetail, levelFor } from "@keylow/core";

import type { AchievementId, AchievementResult, OverviewBadge } from "@keylow/core";

// Made-up results for the stories: the board's daily streaks, with six earned, and the rest 40 percent of the way.
const EARNED: readonly AchievementId[] = [
  "first-bite",
  "hat-trick",
  "full-week",
  "fortnight",
  "back-on-track",
  "saved-by-the-snow",
];

const results: AchievementResult[] = ACHIEVEMENTS.map(({ id, target }) =>
  EARNED.includes(id)
    ? { id, earned: true }
    : { id, earned: false, progress: { current: Math.floor(target * 0.4), target } },
);

export const storyOverview = achievementsOverview({
  results,
  level: levelFor(1180),
  streakDays: 12,
  freezes: 3,
});

export const storyBeginnerOverview = achievementsOverview({
  results: results.map(({ id }, index) => ({
    id,
    earned: false,
    progress: { current: 0, target: ACHIEVEMENTS[index]?.target ?? 1 },
  })),
  level: levelFor(0),
  streakDays: 0,
  freezes: 1,
});

const badges = storyOverview.categories.flatMap((category) => category.badges);

export function storyBadge(id: AchievementId): OverviewBadge {
  const badge = badges.find((candidate) => candidate.id === id);
  if (badge === undefined) {
    throw new Error(`The story fixtures have no badge ${id}`);
  }
  return badge;
}

export function storyCategory(index: number) {
  const category = storyOverview.categories[index];
  if (category === undefined) {
    throw new Error(`The story fixtures have no category ${index}`);
  }
  return category;
}

export function storyDetail(id: AchievementId) {
  const result = results.find((candidate) => candidate.id === id);
  if (result === undefined) {
    throw new Error(`The story fixtures have no badge ${id}`);
  }
  return badgeDetail({ id, result, earnedOn: result.earned ? "2026-11-06" : null });
}
